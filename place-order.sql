-- ============================================================
-- ATOMIC ORDER PLACEMENT
-- ============================================================
--
-- Run this once, after schema.sql and rls.sql.
--
-- Placing an order used to be three separate writes from the
-- browser: insert the header, insert the lines, and (on
-- failure) delete the header again. That left three holes.
--
--   1. Nothing decremented stock, so two shoppers could each
--      pass the availability check and both buy the last unit.
--   2. The rollback delete had no policy behind it for guest
--      orders, so a failed line write left an order header
--      with no lines sitting in the admin screen.
--   3. order_items_insert_guest let anyone holding an order's
--      uuid append lines to it.
--
-- Doing the whole placement inside one SECURITY DEFINER
-- function closes all three: it is a single transaction, the
-- stock decrement is conditional so it cannot oversell, and
-- the browser no longer needs any insert permission at all.

-- ------------------------------------------------------------
-- 1. THE FUNCTION
-- ------------------------------------------------------------
--
-- p_items is the cart, as a json array:
--   [{ "product_id": uuid,
--      "variant_ids": [uuid, ...],
--      "quantity": int,
--      "unit_price": numeric }, ...]
--
-- Returns the new order id.

create or replace function public.place_order(
  p_user_id          uuid,
  p_shipping_address text,
  p_payment_method   text,
  p_notes            text,
  p_total_amount     numeric,
  p_items            jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_item       jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity   integer;
  v_unit_price numeric;
  v_name       text;
  v_available  integer;
begin
  /*
   * SECURITY DEFINER means RLS is not consulted inside here, so the checks
   * the policies would have made have to be made by hand.
   *
   * A signed-in shopper may only order as themselves; p_user_id null is a
   * guest order, which is allowed from an anonymous session.
   */
  if p_user_id is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Cannot place an order on behalf of another account.'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot place an order with an empty cart.';
  end if;

  insert into public.orders (
    user_id, status, total_amount, shipping_address,
    billing_address, payment_method, payment_status, notes
  )
  values (
    p_user_id, 'pending', p_total_amount, p_shipping_address,
    null, p_payment_method, 'pending', p_notes
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity   := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;

    /* order_items records one variant per line; the cart may hold several
     * (size *and* colour), and every one of them has to be decremented. */
    v_variant_id := (v_item -> 'variant_ids' ->> 0)::uuid;

    if v_quantity is null or v_quantity < 1 then
      raise exception 'Every cart line needs a quantity of at least 1.';
    end if;

    select name into v_name from public.products where id = v_product_id;

    if v_name is null then
      raise exception 'That product is no longer available.';
    end if;

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

/*
 * The browser calls this as the anon or authenticated role. Nothing else
 * needs it, and revoking from public keeps it off any other role.
 */
revoke all on function public.place_order(uuid, text, text, text, numeric, jsonb) from public;
grant execute on function public.place_order(uuid, text, text, text, numeric, jsonb)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 2. CLOSE THE DIRECT WRITE PATHS
-- ------------------------------------------------------------
--
-- place_order is now the only way an order is created, so the
-- browser does not need insert permission on either table. In
-- particular this retires order_items_insert_guest, which let
-- anyone holding an order's uuid append lines to it.
--
-- Reads are untouched: a shopper still sees their own orders,
-- and staff still see and update everything.

drop policy if exists "orders_insert_own"       on orders;
drop policy if exists "orders_insert_guest"     on orders;
drop policy if exists "order_items_insert_own"  on order_items;
drop policy if exists "order_items_insert_guest" on order_items;
