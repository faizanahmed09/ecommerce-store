-- ---------------------------------------------------------
-- 011 - Rate limit order tracking
-- ---------------------------------------------------------
--
-- The last function granted to anon that 009 did not cover.
-- Lower risk than redeem_coupon, because it needs the
-- customer's email as well as the reference and so is not an
-- oracle on its own - but it is the remaining unmetered way to
-- ask the database about real orders, and someone holding a
-- leaked email list could grind the eight-character reference
-- space against it. The limiter already exists; this is the
-- last door to put it on.
--
-- The function becomes plpgsql to gain somewhere to put the
-- guard. It cannot go in the WHERE clause of the SQL version:
-- check_rate_limit writes, so a `stable` function may not call
-- it, and a predicate is evaluated per candidate row, which
-- would count one lookup many times over.
--
-- The query itself is unchanged.

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
language plpgsql
security definer
set search_path = public
as $$
begin
  /*
   * Thirty a minute per address. Tracking an order is two or
   * three attempts by someone who mistyped their reference.
   *
   * Returns nothing rather than raising: a caller who has run
   * out gets the same empty answer as a wrong reference, so a
   * guesser cannot tell "slow down" from "not found" and learns
   * nothing about whether they were close.
   */
  if not public.check_rate_limit('track_order', public.request_ip(), 30, 60) then
    return;
  end if;

  return query
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
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
