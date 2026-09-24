-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
--
-- REVIEW BEFORE RUNNING. Nothing in schema.sql enables RLS, so
-- every table is currently readable AND writable by anyone
-- holding the public anon key (it ships in the browser bundle).
--
-- Most urgently: users.user_type gates the admin panel, so
-- without these policies any visitor can run
--
--   update users set user_type = 'admin' where email = '...';
--
-- and let themselves into /admin.
--
-- ------------------------------------------------------------
-- 1. HELPERS
-- ------------------------------------------------------------
-- SECURITY DEFINER so these can read users without re-entering
-- the policies defined on users (which would recurse).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and user_type = 'admin'
  );
$$;

create or replace function public.current_user_type()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select user_type from public.users where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 2. PROFILE CREATION
-- ------------------------------------------------------------
-- With email confirmation enabled there is no session at the
-- moment of sign-up, so the browser cannot insert the profile
-- row under RLS. This trigger creates it server-side instead.
--
-- The app's signUp() is written to tolerate a row that already
-- exists, so it keeps working once this trigger is installed.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, password_hash, user_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'managed_by_supabase_auth',  -- schema requires NOT NULL; auth owns the real credential
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------
-- 3. USERS
-- ------------------------------------------------------------

alter table users enable row level security;

create policy "users_select_own_or_admin" on users
  for select using (id = auth.uid() or public.is_admin());

create policy "users_insert_self" on users
  for insert with check (id = auth.uid());

-- A user may edit their own profile but NOT promote themselves:
-- user_type has to stay exactly what it already is.
create policy "users_update_own" on users
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and user_type = public.current_user_type());

create policy "users_admin_manage" on users
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 4. CATALOGUE — public read, admin write
-- ------------------------------------------------------------

alter table categories       enable row level security;
alter table products         enable row level security;
alter table product_images   enable row level security;
alter table product_variants enable row level security;

create policy "categories_public_read" on categories for select using (true);
create policy "categories_admin_write" on categories for all
  using (public.is_admin()) with check (public.is_admin());

create policy "products_public_read" on products for select using (true);
create policy "products_admin_write" on products for all
  using (public.is_admin()) with check (public.is_admin());

create policy "product_images_public_read" on product_images for select using (true);
create policy "product_images_admin_write" on product_images for all
  using (public.is_admin()) with check (public.is_admin());

create policy "product_variants_public_read" on product_variants for select using (true);
create policy "product_variants_admin_write" on product_variants for all
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 5. ORDERS — owner reads, admin manages
-- ------------------------------------------------------------

alter table orders      enable row level security;
alter table order_items enable row level security;

create policy "orders_select_own_or_admin" on orders
  for select using (user_id = auth.uid() or public.is_admin());

create policy "orders_insert_own" on orders
  for insert with check (user_id = auth.uid());

-- Guest checkout. A shopper without an account places an order
-- that belongs to nobody; it reaches the admin Orders screen as
-- a Guest. The select policy above is unchanged, so the row
-- stays unreadable to everyone but staff -- which is why the
-- confirmation page is rendered from the browser's own state.
create policy "orders_insert_guest" on orders
  for insert with check (user_id is null);

-- Only staff change fulfilment state, which is what the admin
-- Orders screen does.
create policy "orders_admin_update" on orders
  for all using (public.is_admin()) with check (public.is_admin());

create policy "order_items_select_own_or_admin" on order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

create policy "order_items_insert_own" on order_items
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- The lines of a guest order. Anyone holding the order's uuid
-- could append to it, which was the cost of writing guest
-- orders straight from the browser. Section 9 closes that: it
-- moves placement into a security definer function and drops
-- this policy, so the definition below is only what section 9
-- then takes away.
create policy "order_items_insert_guest" on order_items
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.user_id is null
    )
  );

create policy "order_items_admin_manage" on order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 6. CARTS & WISHLISTS — strictly the owner's
-- ------------------------------------------------------------
--
-- NOTE: guest carts (user_id null, identified only by
-- session_id) are NOT covered. Allowing anonymous access to
-- them would let anyone read any guest cart by guessing a
-- session id. Decide whether guest carts should live in the
-- database at all, or stay in localStorage as they do today.

alter table carts          enable row level security;
alter table cart_items     enable row level security;
alter table wishlists      enable row level security;
alter table wishlist_items enable row level security;

create policy "carts_own" on carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cart_items_own" on cart_items
  for all using (
    exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
  );

create policy "wishlists_own" on wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wishlist_items_own" on wishlist_items
  for all using (
    exists (select 1 from wishlists w where w.id = wishlist_items.wishlist_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from wishlists w where w.id = wishlist_items.wishlist_id and w.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 7. GRANT YOURSELF ADMIN
-- ------------------------------------------------------------
-- Run once, from the SQL editor (which bypasses RLS), or you
-- will lock yourself out of /admin.
--
-- update users set user_type = 'admin' where email = 'you@example.com';

-- ------------------------------------------------------------
-- 8. ADDRESSES — strictly the owner's
-- ------------------------------------------------------------
--
-- Staff have no reason to browse saved addresses: an order
-- already carries the address it was shipped to.

alter table addresses enable row level security;

create policy "addresses_own" on addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ------------------------------------------------------------
-- 9. ATOMIC ORDER PLACEMENT
-- ------------------------------------------------------------
--
-- Placing an order is a single SECURITY DEFINER transaction so
-- that the header, its lines and the stock decrements are
-- all-or-nothing, and so the conditional decrement cannot
-- oversell under concurrency. The browser has no insert
-- permission on orders or order_items as a result - the insert
-- policies that used to grant it are dropped at the end.
--
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
