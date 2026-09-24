-- ---------------------------------------------------------
-- 008 - Rate limiting
-- ---------------------------------------------------------
--
-- Nothing in the shop had any. That matters most for
-- redeem_coupon: it is granted to anon, the anon key ships in
-- the JavaScript bundle, and it answers "not recognised" or a
-- discount for whatever code it is handed. Coupon codes are
-- short and memorable by design, so that is a guessing oracle
-- anyone can run at full speed.
--
-- 007 capped what a guessed code is worth by making max_uses
-- bind. This raises the cost of guessing in the first place.
--
-- Done in Postgres rather than in a route handler because
-- serverless instances do not share memory: an in-process
-- counter limits one instance and lets every other one through.
-- The database is the only thing all of them agree on.

-- ---------------------------------------------------------
-- Counters
-- ---------------------------------------------------------
--
-- Fixed windows rather than a sliding log: one row per
-- (bucket, key, window) that is incremented in place, instead
-- of a row per attempt that has to be counted and swept. Less
-- precise at a window boundary - a caller can spend its budget
-- at the end of one window and again at the start of the next -
-- and enormously cheaper. For turning enumeration from free
-- into expensive, that trade is the right way round.

create table if not exists public.rate_limit_counters (
  /* What is being limited, e.g. 'coupon'. */
  bucket       text        not null,
  /* Who is being limited, usually an IP. */
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,

  primary key (bucket, key, window_start)
);

alter table public.rate_limit_counters enable row level security;

/*
 * No policy at all, deliberately. Every reader and writer is a
 * SECURITY DEFINER function below, and RLS with no policy means
 * nobody reaches the table directly - a caller who could write
 * here could exhaust someone else's budget for them.
 */

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);


-- ---------------------------------------------------------
-- Who is calling
-- ---------------------------------------------------------
--
-- PostgREST publishes the request's headers as a GUC. The
-- first entry of X-Forwarded-For is the client as far as the
-- edge is concerned.
--
-- This is spoofable in principle - a header is whatever the
-- sender says - but the proxy in front of Supabase rewrites it,
-- so an attacker gets one identity per real source address.
-- That is enough: the point is to make enumeration cost
-- something, not to make it impossible.

create or replace function public.request_ip()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(
      btrim(
        split_part(
          coalesce(
            current_setting('request.headers', true)::json ->> 'x-forwarded-for',
            ''
          ),
          ',',
          1
        )
      ),
      ''
    ),
    /* Not called through PostgREST - psql, a trigger, a test. */
    'local'
  );
$$;

revoke all on function public.request_ip() from public;


-- ---------------------------------------------------------
-- The limiter
-- ---------------------------------------------------------
--
-- Returns true when the call is allowed. One statement does the
-- counting: the upsert is atomic, so two requests arriving
-- together cannot both read the same count and both decide they
-- are under the limit.
--
-- Deliberately NOT granted to anon. It is called from inside
-- the SECURITY DEFINER functions that need it. Exposed
-- directly, anyone could pass another caller's key and spend
-- their budget for them - a rate limiter that hands out denial
-- of service is worse than none.

create or replace function public.check_rate_limit(
  p_bucket         text,
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_hits         integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key, window_start)
  do update set hits = public.rate_limit_counters.hits + 1
  returning hits into v_hits;

  /*
   * Swept here rather than by a scheduled job, so the table
   * cannot grow without bound on a deployment nobody has set
   * cron up on. One call in a hundred pays for it.
   */
  if random() < 0.01 then
    delete from public.rate_limit_counters
     where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
