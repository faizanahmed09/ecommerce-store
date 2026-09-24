-- ---------------------------------------------------------
-- 012 - Distinct filter options, from the database
-- ---------------------------------------------------------
--
-- The filter rail offers the sizes and colours the shop
-- actually stocks. It got them by selecting every row of
-- product_variants and reducing them in JavaScript - at four
-- products that is 44 rows to produce 11 options, and at a
-- hundred products it is about 1,100 rows to produce roughly
-- the same twenty-five. Forty times the bytes for an answer
-- that never changes shape.
--
-- The reduction belongs where the rows are. DISTINCT ON picks
-- one representative per (name, value) exactly as the
-- JavaScript did, and ordering by id makes which one it picks
-- deterministic rather than whatever the heap returned first.
--
-- Caching this (lib/catalogue.ts) already meant one read per
-- window rather than one per visitor. This makes that one read
-- small as well.

create or replace function public.list_variant_options()
returns table (
  id               uuid,
  name             varchar(100),
  value            varchar(100),
  price_adjustment numeric(10,2),
  stock_quantity   integer
)
language sql
security definer
set search_path = public
stable
as $$
  /*
   * Qualified through the alias throughout: the OUT columns
   * above share their names with the table's, and an
   * unqualified reference to either is the 42702 that
   * redeem_coupon's `where upper(code) = ...` used to raise.
   */
  select distinct on (lower(pv.name), lower(pv.value))
    pv.id,
    pv.name,
    pv.value,
    pv.price_adjustment,
    pv.stock_quantity
  from public.product_variants pv
  order by lower(pv.name), lower(pv.value), pv.id;
$$;

revoke all on function public.list_variant_options() from public;
grant execute on function public.list_variant_options() to anon, authenticated;
