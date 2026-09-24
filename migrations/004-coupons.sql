-- ---------------------------------------------------------
-- 004 - Discount codes
-- ---------------------------------------------------------
--
-- The cart has had a coupon box since the beginning. It was a
-- setTimeout that answered "Invalid coupon" to everything, so
-- every customer who tried a code was told theirs had expired.
-- This is the table behind a box that can actually say yes.
--
-- Validation lives in redeem_coupon() below rather than in the
-- browser: a discount the client computes is a discount the
-- client can choose, and the cart total is already something
-- place_order recomputes for exactly that reason.

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  /* Stored upper-case; lookups upper-case what the shopper typed. */
  code          varchar(40)  not null,
  description   text,

  /* 'percent' takes discount_value off as a %, 'fixed' as an amount. */
  discount_type varchar(10)  not null default 'percent',
  discount_value numeric(10,2) not null,

  /* Basket subtotal required before the code applies at all. */
  min_subtotal  numeric(10,2) not null default 0,
  /* Ceiling for a percentage code, so "50% off" cannot run away. */
  max_discount  numeric(10,2),

  starts_at     timestamptz,
  expires_at    timestamptz,

  /* null means unlimited. */
  max_uses      integer,
  times_used    integer not null default 0,

  active        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  constraint coupons_discount_type_check
    check (discount_type in ('percent', 'fixed')),
  constraint coupons_discount_value_check
    check (discount_value > 0),
  constraint coupons_percent_range_check
    check (discount_type <> 'percent' or discount_value <= 100)
);

-- Codes are matched case-insensitively, so uniqueness has to be too.
create unique index if not exists coupons_code_unique
  on public.coupons (upper(code));

alter table public.coupons enable row level security;

/*
 * Deliberately no public read policy. A shopper never lists
 * coupons - they present one code and the function below says
 * yes or no. Without this, `select * from coupons` would hand
 * anyone every unreleased discount in the shop.
 *
 * Dropped first because `create policy` has no `if not exists`
 * counterpart: everything else in this file can be re-run over
 * a database that already has it, and a migration that is safe
 * to re-run except for one line is not safe to re-run.
 */
drop policy if exists "coupons_admin_manage" on public.coupons;

create policy "coupons_admin_manage" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists coupons_active_idx
  on public.coupons (active) where active;


-- ---------------------------------------------------------
-- Redemption check
-- ---------------------------------------------------------
--
-- Returns the discount for a code against a given subtotal, or
-- a row explaining why not. SECURITY DEFINER so it can read a
-- table the shopper cannot, and it returns only the verdict -
-- never the coupon row.

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

revoke all on function public.redeem_coupon(text, numeric) from public;
grant execute on function public.redeem_coupon(text, numeric) to anon, authenticated;
