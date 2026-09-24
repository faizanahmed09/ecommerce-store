-- ---------------------------------------------------------
-- 006 - Server-authoritative order totals
-- ---------------------------------------------------------
--
-- place_order used to take the money on trust. `p_total_amount`
-- went into orders.total_amount verbatim, and each line's
-- `unit_price` went into order_items verbatim; the only thing
-- it ever read from products was the name. Stock was defended
-- properly - the conditional UPDATE is sound - but price was
-- not defended at all.
--
-- The anon key ships inside the JavaScript bundle, so this was
-- reachable by anyone: POST to /rest/v1/rpc/place_order with
-- unit_price 1 and a matching total, and the shop writes a real
-- order at a price the buyer chose, decrementing real stock.
--
-- So the browser's arithmetic becomes a display concern. This
-- function now recomputes the subtotal from products and
-- product_variants, re-checks the discount code against
-- redeem_coupon, applies delivery itself, and refuses the order
-- if the figure the shopper agreed to is not the figure it
-- arrives at.
--
-- 004's header comment claimed place_order already recomputed
-- the total. It did not. Now it does.

-- ---------------------------------------------------------
-- What the computed total was made of
-- ---------------------------------------------------------
--
-- A server-computed total nobody can break down is not
-- auditable, so the components are recorded beside it.
-- contact_email is here because a guest leaves no users row and
-- their address was previously only recoverable by parsing it
-- back out of the notes column.

alter table public.orders
  add column if not exists discount_amount      numeric(10,2) not null default 0,
  add column if not exists coupon_code          varchar(40),
  add column if not exists contact_email        text,
  add column if not exists confirmation_sent_at timestamptz;

comment on column public.orders.discount_amount is
  'What the discount code took off, as computed by place_order.';
comment on column public.orders.coupon_code is
  'The code that produced discount_amount, or null.';
comment on column public.orders.contact_email is
  'Where the confirmation was sent. Set for guest and signed-in orders alike.';
comment on column public.orders.confirmation_sent_at is
  'Claimed by claim_order_confirmation(); null means not yet emailed.';


-- ---------------------------------------------------------
-- What one line actually costs
-- ---------------------------------------------------------
--
-- Mirrors getEffectivePrice() in src/app/lib/products.ts and
-- the price shown on the product page: sale_price when it is
-- genuinely cheaper than list, plus the adjustment carried by
-- each chosen variant.
--
-- Kept separate from place_order so the pricing rule can be
-- read - and tested - on its own.

create or replace function public.effective_unit_price(
  p_product_id  uuid,
  p_variant_ids jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_price      numeric(10,2);
  v_sale_price numeric(10,2);
  v_base       numeric(10,2);
  v_adjust     numeric(10,2);
begin
  select p.price, p.sale_price
    into v_price, v_sale_price
  from public.products p
  where p.id = p_product_id;

  /* No such product. The caller turns this into its own error. */
  if v_price is null then
    return null;
  end if;

  /* A sale_price only counts when it is actually cheaper. */
  v_base := case
    when v_sale_price is not null and v_sale_price > 0 and v_sale_price < v_price
      then v_sale_price
    else v_price
  end;

  /*
   * Scoped to the product, so an id belonging to a different
   * product contributes nothing. place_order separately refuses
   * a line whose variant does not belong to it, so a mismatch
   * cannot quietly become a cheaper order here.
   */
  select coalesce(sum(pv.price_adjustment), 0)
    into v_adjust
  from public.product_variants pv
  where pv.product_id = p_product_id
    and pv.id in (
      select (value #>> '{}')::uuid
      from jsonb_array_elements(coalesce(p_variant_ids, '[]'::jsonb))
    );

  return round(v_base + v_adjust, 2);
end;
$$;

revoke all on function public.effective_unit_price(uuid, jsonb) from public;
grant execute on function public.effective_unit_price(uuid, jsonb) to anon, authenticated;


-- ---------------------------------------------------------
-- place_order, recomputing
-- ---------------------------------------------------------
--
-- The old six-argument signature is dropped rather than left
-- beside this one: a default argument would make a six-argument
-- call ambiguous, and leaving the trusting version callable
-- would leave the hole open.

drop function if exists public.place_order(uuid, text, text, text, numeric, jsonb);

create or replace function public.place_order(
  p_user_id          uuid,
  p_shipping_address text,
  p_payment_method   text,
  p_notes            text,
  /* Now a cross-check rather than the source of truth. */
  p_total_amount     numeric,
  p_items            jsonb,
  p_coupon_code      text default null,
  p_contact_email    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Mirrors SHIPPING_FEE and FREE_SHIPPING_THRESHOLD in
   * src/app/lib/order-totals.ts. Two languages cannot share one
   * constant, so they point at each other instead - change one
   * and the mismatch check below starts rejecting every order,
   * which is the loudest failure available.
   */
  c_shipping_fee   constant numeric(10,2) := 300;
  c_free_threshold constant numeric(10,2) := 5000;

  v_order_id   uuid;
  v_item       jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity   integer;
  v_unit_price numeric(10,2);
  v_name       text;
  v_available  integer;

  /* Pass 1 writes the priced lines here; pass 2 reads them. */
  v_priced     jsonb := '[]'::jsonb;

  v_subtotal   numeric(10,2) := 0;
  v_discount   numeric(10,2) := 0;
  v_discounted numeric(10,2);
  v_shipping   numeric(10,2);
  v_total      numeric(10,2);

  v_valid      boolean;
  v_reason     text;
  v_code       varchar(40);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item.';
  end if;

  -- -------------------------------------------------------
  -- Pass 1: price every line from the database
  -- -------------------------------------------------------
  --
  -- Nothing is written yet. A basket that fails the total check
  -- below should not have touched stock on its way there, and
  -- reading first keeps that obvious rather than relying on the
  -- rollback to tidy up.

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity   := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity < 1 then
      raise exception 'Every cart line needs a quantity of at least 1.';
    end if;

    select name into v_name from public.products where id = v_product_id;

    if v_name is null then
      raise exception 'That product is no longer available.';
    end if;

    /* Whatever the client sent as unit_price is ignored. */
    v_unit_price := public.effective_unit_price(v_product_id, v_item -> 'variant_ids');

    v_subtotal := round(v_subtotal + round(v_unit_price * v_quantity, 2), 2);

    v_priced := v_priced || jsonb_build_object(
      'product_id',  v_product_id,
      'quantity',    v_quantity,
      'unit_price',  v_unit_price,
      'variant_ids', coalesce(v_item -> 'variant_ids', '[]'::jsonb),
      'name',        v_name
    );
  end loop;

  -- -------------------------------------------------------
  -- The discount, re-earned
  -- -------------------------------------------------------
  --
  -- redeem_coupon is asked again, against the subtotal this
  -- function computed rather than the one the browser reported.
  -- A code that has expired or been spent between the cart and
  -- this call is refused here, in its own words.

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select r.valid, r.reason, r.code, r.discount
      into v_valid, v_reason, v_code, v_discount
    from public.redeem_coupon(p_coupon_code, v_subtotal) r;

    if not coalesce(v_valid, false) then
      raise exception '%', coalesce(v_reason, 'That discount code cannot be used.')
        using errcode = 'LM001';
    end if;
  end if;

  -- -------------------------------------------------------
  -- Delivery and the total
  -- -------------------------------------------------------
  --
  -- Same rule as calculateOrderTotals(): the threshold is
  -- judged on what is paid for goods after the discount, and an
  -- empty basket is not a free delivery.

  v_discounted := round(v_subtotal - coalesce(v_discount, 0), 2);
  v_shipping   := case
                    when v_discounted > 0 and v_discounted >= c_free_threshold then 0
                    else c_shipping_fee
                  end;
  v_total      := round(v_discounted + v_shipping, 2);

  /*
   * A paisa of tolerance for the rounding either side does
   * independently. Anything wider than that is either a price
   * that moved while the shopper was filling the form, or a
   * total that was never the shop's to begin with - and both
   * deserve the order refused rather than silently rewritten to
   * a figure nobody agreed to.
   */
  if p_total_amount is not null and abs(p_total_amount - v_total) > 0.01 then
    raise exception
      'The price of something in your basket has changed. The total is now Rs. %.',
      trim(to_char(v_total, 'FM999,999,990.00'))
      using errcode = 'LM001';
  end if;

  insert into public.orders (
    user_id, status, total_amount, discount_amount, coupon_code,
    shipping_address, billing_address, payment_method, payment_status,
    notes, contact_email
  )
  values (
    p_user_id, 'pending', v_total, coalesce(v_discount, 0), v_code,
    p_shipping_address, null, p_payment_method, 'pending',
    p_notes, nullif(btrim(coalesce(p_contact_email, '')), '')
  )
  returning id into v_order_id;

  -- -------------------------------------------------------
  -- Pass 2: take the stock, write the lines
  -- -------------------------------------------------------

  for v_item in select * from jsonb_array_elements(v_priced)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity   := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_name       := v_item ->> 'name';

    /* order_items records one variant per line; the cart may hold several
     * (size *and* colour), and every one of them has to be decremented. */
    v_variant_id := (v_item -> 'variant_ids' ->> 0)::uuid;

    if v_variant_id is null then
      /*
       * The conditional UPDATE is what makes this safe under concurrency:
       * READ COMMITTED re-evaluates the WHERE clause after waiting on a
       * row another transaction has locked, so two shoppers racing for the
       * last unit cannot both satisfy stock_quantity >= v_quantity.
       */
      update public.products
         set stock_quantity = stock_quantity - v_quantity,
             updated_at     = now()
       where id = v_product_id
         and stock_quantity >= v_quantity;

      if not found then
        select stock_quantity into v_available
          from public.products where id = v_product_id;

        raise exception '% — only % left, % requested.',
          v_name, coalesce(v_available, 0), v_quantity;
      end if;
    else
      /* Each chosen option carries its own stock, so each is decremented. */
      declare
        v_each uuid;
      begin
        for v_each in
          select (value #>> '{}')::uuid from jsonb_array_elements(v_item -> 'variant_ids')
        loop
          update public.product_variants
             set stock_quantity = stock_quantity - v_quantity,
                 updated_at     = now()
           where id = v_each
             and product_id = v_product_id
             and stock_quantity >= v_quantity;

          if not found then
            select stock_quantity into v_available
              from public.product_variants where id = v_each;

            raise exception '% — only % left, % requested.',
              v_name, coalesce(v_available, 0), v_quantity;
          end if;
        end loop;
      end;
    end if;

    insert into public.order_items (
      order_id, product_id, product_variant_id,
      quantity, unit_price, total_price
    )
    values (
      v_order_id, v_product_id, v_variant_id,
      v_quantity, v_unit_price, round(v_unit_price * v_quantity, 2)
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function
  public.place_order(uuid, text, text, text, numeric, jsonb, text, text) from public;
grant execute on function
  public.place_order(uuid, text, text, text, numeric, jsonb, text, text)
  to anon, authenticated;


-- ---------------------------------------------------------
-- Claiming an order for its confirmation email
-- ---------------------------------------------------------
--
-- The mail is sent by /api/orders/confirmation, which needs to
-- read an order a guest has no policy to read - and needs to
-- send exactly one mail per order however many times it is
-- called (a double-submit, a retry, a refreshed success page).
--
-- Both fall out of one atomic claim: the UPDATE only matches
-- while confirmation_sent_at is still null, so the first caller
-- gets the order and every later one gets nothing. No service
-- key is involved; this returns one order, only to whoever
-- already holds its id, and only once.
--
-- The 24-hour bound keeps an old id from being replayed into a
-- fresh mail long after the fact.

create or replace function public.claim_order_confirmation(p_order_id uuid)
returns table (
  order_id        uuid,
  contact_email   text,
  total_amount    numeric(10,2),
  discount_amount numeric(10,2),
  coupon_code     varchar(40),
  payment_method  varchar(50),
  shipping_addr   text,
  placed_at       timestamptz,
  items           jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  update public.orders o
     set confirmation_sent_at = now()
   where o.id = p_order_id
     and o.confirmation_sent_at is null
     and o.contact_email is not null
     and o.created_at > now() - interval '24 hours'
  returning o.* into v_order;

  /* Already sent, no address, or too old. The caller says so. */
  if not found then
    return;
  end if;

  return query
  select
    v_order.id,
    v_order.contact_email,
    v_order.total_amount,
    v_order.discount_amount,
    v_order.coupon_code,
    v_order.payment_method,
    v_order.shipping_address,
    v_order.created_at,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'name',        p.name,
                   'quantity',    oi.quantity,
                   'unit_price',  oi.unit_price,
                   'total_price', oi.total_price
                 )
                 order by p.name
               )
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = v_order.id
      ),
      '[]'::jsonb
    );
end;
$$;

revoke all on function public.claim_order_confirmation(uuid) from public;
grant execute on function public.claim_order_confirmation(uuid) to anon, authenticated;
