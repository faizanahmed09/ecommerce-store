-- ---------------------------------------------------------
-- 002 - Guest order tracking
-- ---------------------------------------------------------
--
-- /track-order needs to answer "where is my order" for someone
-- who checked out without an account.
--
-- It cannot do that through the table. `orders_select_own_or_admin`
-- reads `user_id = auth.uid() or is_admin()`, and a guest order
-- has `user_id is null`, so it belongs to nobody and is
-- readable by staff alone. That is the correct policy - it is
-- what stops one shopper reading another's orders - so this
-- adds a narrow, checked way through it rather than widening it.
--
-- SECURITY DEFINER means RLS is not consulted inside the
-- function, so the check the policy would have made is made
-- here by hand: the caller has to present BOTH the order id and
-- the email the order was placed with. The id alone is not
-- enough, because order ids travel in confirmation emails and
-- screenshots.
--
-- It returns status only. Never the address, never the notes -
-- the notes hold the guest's phone number.

create or replace function public.track_order(
  p_order_id uuid,
  p_email    text
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
  where o.id = p_order_id
    and coalesce(btrim(p_email), '') <> ''
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
        and position(lower(btrim(p_email)) in lower(o.notes)) > 0
      )
      /* An account order matches the account's own email. */
      or (
        o.user_id is not null
        and lower(u.email) = lower(btrim(p_email))
      )
    )
  limit 1;
$$;

-- Callable by shoppers, signed in or not. Nothing else is
-- granted: the function is the entire surface.
revoke all on function public.track_order(uuid, text) from public;
grant execute on function public.track_order(uuid, text) to anon, authenticated;
