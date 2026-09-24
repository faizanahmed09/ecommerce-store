-- ---------------------------------------------------------
-- 003 - Look an order up by its short number
-- ---------------------------------------------------------
--
-- Replaces track_order from 002.
--
-- 002 took the order's uuid. That is fine for a link, and
-- useless for a person: nobody reads 36 characters down a
-- phone or types them from a screenshot. The number a customer
-- is now given is the uuid's first block, prefixed - LM-C3F9A1C0
-- - so the lookup has to accept that as well.
--
-- The signature changes from uuid to text, so the old function
-- is dropped rather than replaced. Safe to run before or after
-- 002; it does not depend on it.
--
-- What has NOT changed: the email is still required, and it is
-- still what proves the order is yours. A short code narrows
-- 8 hex characters, which is not a secret on its own and is
-- not treated as one.

drop function if exists public.track_order(uuid, text);
drop function if exists public.track_order(text, text);

-- Prefix matching would otherwise scan the table. Postgres can
-- use this for `left(id::text, 8) = ...` because the index is
-- on exactly that expression.
create index if not exists orders_short_id_idx
  on public.orders (left(id::text, 8));

create or replace function public.track_order(
  p_reference text,
  p_email     text
)
returns table (
  id              uuid,
  status          varchar(50),
  payment_status  varchar(50),
  tracking_number varchar(100),
  total_amount    numeric,
  created_at      timestamptz,
  updated_at      timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with input as (
    select
      lower(btrim(p_reference)) as ref,
      lower(btrim(p_email))     as email
  )
  select
    o.id,
    o.status,
    o.payment_status,
    o.tracking_number,
    o.total_amount,
    o.created_at,
    o.updated_at
  from public.orders o
  left join public.users u on u.id = o.user_id
  cross join input i
  where i.email <> ''
    and i.ref <> ''
    and (
      /* The full uuid, as it appears in the confirmation URL. */
      (length(i.ref) = 36 and o.id::text = i.ref)
      /* Or the short number the customer was shown. */
      or (length(i.ref) = 8 and left(o.id::text, 8) = i.ref)
    )
    and (
      /*
       * A guest order records its contact details in `notes`,
       * as "Guest contact: <email> / <phone>". position() is
       * used rather than LIKE so an address containing % or _
       * cannot be read as a wildcard.
       */
      (
        o.user_id is null
        and o.notes is not null
        and position(i.email in lower(o.notes)) > 0
      )
      /* An account order matches the account's own email. */
      or (
        o.user_id is not null
        and lower(u.email) = i.email
      )
    )
  limit 1;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
