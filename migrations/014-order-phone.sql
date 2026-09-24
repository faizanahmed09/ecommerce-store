-- ---------------------------------------------------------
-- 014 - The customer's phone number
-- ---------------------------------------------------------
--
-- Checkout has always asked for a phone number and then thrown
-- it away. A guest's ended up inside `notes`, as free text in
-- "Guest contact: <email> / <phone>"; a signed-in customer's
-- was collected by the form and discarded entirely.
--
-- That was survivable while the shop only emailed people. It is
-- not survivable now: a courier needs a number to call, PostEx
-- rejects an order without one outright, and no rider has ever
-- completed a delivery by parsing a notes column.
--
-- So it gets a column of its own, beside contact_email, set the
-- same way and for the same reason.
--
-- Orders placed before this have no phone. They cannot be
-- booked with a courier that requires one - which is a thing to
-- know, not a thing to invent a number for.

alter table public.orders
  add column if not exists contact_phone text;

comment on column public.orders.contact_phone is
  'Where the courier calls. Set for guest and signed-in orders alike.';


-- ---------------------------------------------------------
-- place_order, carrying it through
-- ---------------------------------------------------------
--
-- The eight-argument signature is dropped rather than left
-- beside this one: a default argument would make an
-- eight-argument call ambiguous.

drop function if exists public.place_order(uuid, text, text, text, numeric, jsonb, text, text);

create or replace function public.place_order(
  p_user_id          uuid,
  p_shipping_address text,
  p_payment_method   text,
  p_notes            text,
  /* Now a cross-check rather than the source of truth. */
  p_total_amount     numeric,
  p_items            jsonb,
  p_coupon_code      text default null,
  p_contact_email    text default null,
  p_contact_phone    text default null
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
    notes, contact_email, contact_phone
  )
  values (
    p_user_id, 'pending', v_total, coalesce(v_discount, 0), v_code,
    p_shipping_address, null, p_payment_method, 'pending',
    p_notes,
    nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_phone, '')), '')
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
  public.place_order(uuid, text, text, text, numeric, jsonb, text, text, text) from public;
grant execute on function
  public.place_order(uuid, text, text, text, numeric, jsonb, text, text, text)
  to anon, authenticated;
