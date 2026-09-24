-- ---------------------------------------------------------
-- 009 - Rate limit the two functions anyone can reach
-- ---------------------------------------------------------
--
-- 008 built the limiter. This puts it in front of the two
-- SECURITY DEFINER functions granted to anon that do real work:
-- redeem_coupon, which is a guessing oracle, and
-- claim_order_confirmation, which sends mail.
--
-- Both call check_rate_limit themselves rather than relying on
-- a guard in a route handler. A guard in a route protects the
-- route; the RPC is reachable without it.
--
-- ---------------------------------------------------------
-- Why redeem_coupon is split in two
-- ---------------------------------------------------------
--
-- place_order re-checks the discount code inside the
-- transaction. If that call went through the limiter, a shopper
-- who had tried twenty codes in the cart would be unable to
-- check out at all - the limiter would have caused a worse
-- outage than the enumeration it exists to slow.
--
-- So the logic moves to coupon_verdict, which nothing outside
-- the database may call, and redeem_coupon becomes a thin
-- public wrapper that counts the attempt first. place_order
-- calls the verdict directly and is never limited.


-- ---------------------------------------------------------
-- The verdict: the rules, reachable only from inside
-- ---------------------------------------------------------

create or replace function public.coupon_verdict(
  p_code     text,
  p_subtotal numeric
)
returns table (
  valid    boolean,
  reason   text,
  code     varchar(40),
  discount numeric(10,2)
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.coupons%rowtype;
  v_discount numeric(10,2);
begin
  /*
   * Aliased, and the column qualified through it: this
   * function RETURNS TABLE (.., code, ..), so a bare `code`
   * here is ambiguous between that OUT column and the one on
   * coupons, and plpgsql raises 42702 rather than guessing.
   */
  select * into c
  from public.coupons cp
  where upper(cp.code) = upper(btrim(p_code))
  limit 1;

  if not found then
    return query select false, 'That code is not recognised.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if not c.active then
    return query select false, 'That code is no longer active.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if c.starts_at is not null and now() < c.starts_at then
    return query select false, 'That code is not available yet.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if c.expires_at is not null and now() > c.expires_at then
    return query select false, 'That code has expired.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if c.max_uses is not null and c.times_used >= c.max_uses then
    return query select false, 'That code has been fully redeemed.'::text, null::varchar(40), 0::numeric(10,2);
    return;
  end if;

  if p_subtotal < c.min_subtotal then
    return query select
      false,
      format('Spend at least Rs. %s to use this code.', trim(to_char(c.min_subtotal, 'FM999,999,990')))::text,
      null::varchar(40),
      0::numeric(10,2);
    return;
  end if;

  if c.discount_type = 'percent' then
    v_discount := round(p_subtotal * (c.discount_value / 100.0), 2);
  else
    v_discount := c.discount_value;
  end if;

  if c.max_discount is not null then
    v_discount := least(v_discount, c.max_discount);
  end if;

  /* A discount can reduce the basket to zero, never below it. */
  v_discount := least(v_discount, p_subtotal);

  return query select true, null::text, c.code, v_discount;
end;
$$;

revoke all on function public.coupon_verdict(text, numeric) from public;

/*
 * Deliberately not granted to anon or authenticated. The only
 * callers are redeem_coupon and place_order below, both
 * SECURITY DEFINER, both in this schema.
 */


-- ---------------------------------------------------------
-- The public entry point: count, then answer
-- ---------------------------------------------------------
--
-- No longer `stable`: it records the attempt before answering.

create or replace function public.redeem_coupon(
  p_code     text,
  p_subtotal numeric
)
returns table (
  valid    boolean,
  reason   text,
  code     varchar(40),
  discount numeric(10,2)
)
language plpgsql
security definer
set search_path = public
as $$
begin
  /*
   * Twenty attempts a minute per address. A shopper types one
   * code and maybe mistypes it once; twenty is far past
   * anything honest and far below what enumeration needs.
   *
   * Refused before the coupons table is consulted, so a guesser
   * cannot read anything from the timing either.
   */
  if not public.check_rate_limit('coupon', public.request_ip(), 20, 60) then
    return query select
      false,
      'Too many attempts. Please wait a minute and try again.'::text,
      null::varchar(40),
      0::numeric(10,2);
    return;
  end if;

  return query select v.valid, v.reason, v.code, v.discount
  from public.coupon_verdict(p_code, p_subtotal) v;
end;
$$;

revoke all on function public.redeem_coupon(text, numeric) from public;
grant execute on function public.redeem_coupon(text, numeric) to anon, authenticated;


-- ---------------------------------------------------------
-- place_order, calling the verdict rather than the wrapper
-- ---------------------------------------------------------

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
    /*
     * coupon_verdict, not redeem_coupon: the public wrapper is
     * rate limited, and this call is the shop's own, made once
     * per order. Routing checkout through the limiter meant a
     * shopper who had tried twenty codes in the cart could no
     * longer buy anything - a self-inflicted outage strictly
     * worse than the guessing it was meant to slow.
     */
    from public.coupon_verdict(p_coupon_code, v_subtotal) r;

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
  -- Spend the redemption
  -- -------------------------------------------------------
  --
  -- times_used was read in three places and written in none:
  -- it sat at 0 forever, so max_uses was decorative. A code
  -- limited to two redemptions could be used for ever, and the
  -- admin's "used 0 times so far" was telling the truth about
  -- the column while lying about the campaign.
  --
  -- The conditional UPDATE is the same shape as the stock
  -- decrement below, and safe for the same reason: under READ
  -- COMMITTED the WHERE clause is re-evaluated after waiting on
  -- a row another transaction holds, so two orders racing for
  -- the last redemption cannot both satisfy times_used <
  -- max_uses. A plain `set times_used = times_used + 1` with the
  -- check done beforehand would let both through.
  --
  -- Deliberately here and not in redeem_coupon: that function
  -- is the cart's preview and runs on every keystroke of the
  -- discount box. A redemption is spent by placing an order,
  -- not by asking what a code is worth - which is also why it
  -- is `stable` and could not write even if we wanted it to.

  if v_code is not null then
    update public.coupons c
       set times_used = c.times_used + 1,
           updated_at = now()
     where upper(c.code) = upper(v_code)
       and (c.max_uses is null or c.times_used < c.max_uses);

    /*
     * Someone took the last redemption between redeem_coupon
     * above and this line. The order is refused rather than
     * quietly granted a discount the code no longer carries -
     * and the whole transaction rolls back, so no stock moves.
     */
    if not found then
      raise exception 'That code has been fully redeemed.'
        using errcode = 'LM001';
    end if;
  end if;

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
-- The confirmation claim, limited
-- ---------------------------------------------------------

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
  /*
   * Ten a minute per address. The honest caller is our own
   * checkout, once per order, so this costs a shopper nothing -
   * it stops the endpoint being used as a mail cannon by
   * someone replaying order ids.
   */
  if not public.check_rate_limit('order_confirmation', public.request_ip(), 10, 60) then
    return;
  end if;

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
