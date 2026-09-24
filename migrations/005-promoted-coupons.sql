-- ---------------------------------------------------------
-- 005 - Promoted discount codes
-- ---------------------------------------------------------
--
-- 004 gave the cart's coupon box a table behind it, but a code
-- nobody has been told about is a code nobody types. The sale
-- page and the homepage now advertise one - which means the
-- shop needs a way to say "this code is public" without
-- undoing the reason coupons has no public read policy.
--
-- So: an opt-in flag, and a function that returns only the
-- codes carrying it. A one-off code written for a support
-- case, or an influencer's private code, stays unlisted
-- because promoted defaults to false.

alter table public.coupons
  add column if not exists promoted boolean not null default false;

comment on column public.coupons.promoted is
  'Advertise this code publicly (sale page banner, homepage modal).';

create index if not exists coupons_promoted_idx
  on public.coupons (promoted) where promoted;


-- ---------------------------------------------------------
-- Public listing
-- ---------------------------------------------------------
--
-- SECURITY DEFINER so it can read a table the shopper cannot,
-- and it returns a deliberately narrow slice: the code and the
-- terms a shopper needs to decide whether it is worth using.
-- `description` is staff-only note-keeping and is not in it.
--
-- The filters mirror redeem_coupon's refusals, so the page
-- never advertises a code the cart would then turn down.

create or replace function public.list_promoted_coupons()
returns table (
  code           varchar(40),
  discount_type  varchar(10),
  discount_value numeric(10,2),
  min_subtotal   numeric(10,2),
  max_discount   numeric(10,2),
  expires_at     timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  /*
   * Every column goes through the alias. The OUT columns above
   * share their names with the ones on coupons, and an
   * unqualified reference to either is ambiguous - the 42702
   * that redeem_coupon's `where upper(code) = ...` used to
   * raise on every code a shopper typed.
   */
  select
    cp.code,
    cp.discount_type,
    cp.discount_value,
    cp.min_subtotal,
    cp.max_discount,
    cp.expires_at
  from public.coupons cp
  where cp.promoted
    and cp.active
    and (cp.starts_at is null or now() >= cp.starts_at)
    and (cp.expires_at is null or now() <= cp.expires_at)
    and (cp.max_uses is null or cp.times_used < cp.max_uses)
  /* Whatever runs out first is the one worth shouting about. */
  order by cp.expires_at asc nulls last, cp.created_at desc
  limit 6;
$$;

revoke all on function public.list_promoted_coupons() from public;
grant execute on function public.list_promoted_coupons() to anon, authenticated;
