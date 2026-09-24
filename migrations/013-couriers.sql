-- ---------------------------------------------------------
-- 013 - Couriers, shipments, and the differences between them
-- ---------------------------------------------------------
--
-- Pakistani couriers share no schema. Leopards wants
-- `consignment_name_eng` and a numeric city id from its own
-- master list; PostEx wants its own vocabulary behind a bearer
-- token; M&P publishes nothing at all. Every one of them
-- invents its own words for "returned".
--
-- So the shop keeps one internal shape and absorbs the
-- differences in three specific places:
--
--   courier_cities      their city ids, because a free-text
--                       city is not something they accept
--   courier_status_map  their status words mapped to ours
--   raw_request/response the exact payloads, kept verbatim
--
-- Anything genuinely per-courier that is NOT one of those three
-- belongs in the adapter code, not in a column.

-- ---------------------------------------------------------
-- Which couriers this shop offers
-- ---------------------------------------------------------
--
-- Deliberately NOT a per-merchant table with credentials in it.
-- This is one shop, so "which couriers are enabled" is one
-- list - and API keys never go in Postgres. The anon key ships
-- inside the JavaScript bundle, so a table holding courier
-- secrets is one missing policy away from handing someone the
-- account that moves your COD money. Secrets live in env vars,
-- read only by a server route, exactly like GMAIL_APP_PASSWORD.
--
-- `config` is for the non-secret settings an adapter needs:
-- the shop's own pickup city id, a default weight, and so on.

create table if not exists public.couriers (
  /* Stable, human-readable: the adapter dispatches on it. */
  code          varchar(20) primary key,
  name          varchar(60)  not null,

  /* The admin's on/off switch - what "the user picks" means. */
  enabled       boolean      not null default false,

  /* Not every courier does cash on delivery everywhere. */
  supports_cod  boolean      not null default true,

  /* Non-secret adapter settings. Never credentials. */
  config        jsonb        not null default '{}'::jsonb,

  /* Order they appear in when the admin books a shipment. */
  sort_order    integer      not null default 0,

  created_at    timestamptz  default now(),
  updated_at    timestamptz  default now(),

  constraint couriers_code_lower check (code = lower(code))
);

-- ---------------------------------------------------------
-- Their cities, and their ids for them
-- ---------------------------------------------------------
--
-- Leopards takes `destination_city` as an integer from its own
-- list. Others differ. A shopper types "Karachi" and the
-- adapter has to turn that into whatever the chosen courier
-- calls it - which is a lookup, not a guess.
--
-- city_id is text rather than integer because only Leopards is
-- known to use numbers, and a schema that assumes that will
-- need changing for the second courier.

create table if not exists public.courier_cities (
  courier_code  varchar(20) not null references public.couriers(code) on delete cascade,
  city_id       varchar(40) not null,
  city_name     varchar(120) not null,

  /* Lowercased and trimmed, so "karachi" finds "Karachi". */
  normalised    text generated always as (lower(btrim(city_name))) stored,

  primary key (courier_code, city_id)
);

create index if not exists courier_cities_lookup_idx
  on public.courier_cities (courier_code, normalised);

-- ---------------------------------------------------------
-- Their status words, mapped to ours
-- ---------------------------------------------------------
--
-- The table exists so that adding a courier - or a status a
-- courier invented last week - is a row, not a deploy. An
-- unmapped status is not an error: the shipment keeps its
-- courier_status verbatim and stays on its last known internal
-- status, so nothing is silently mislabelled as delivered.

create table if not exists public.courier_status_map (
  courier_code    varchar(20) not null references public.couriers(code) on delete cascade,
  /* Exactly as the courier sends it, lowercased for matching. */
  courier_status  text        not null,
  status          varchar(30) not null,

  primary key (courier_code, courier_status)
);

-- ---------------------------------------------------------
-- Shipments
-- ---------------------------------------------------------
--
-- One row per booking attempt, not per order. A parcel that is
-- returned and re-sent is two shipments, and losing that
-- history is losing the answer to "why did this order take
-- three weeks".

create table if not exists public.shipments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid        not null references public.orders(id) on delete cascade,
  courier_code    varchar(20) not null references public.couriers(code),

  /* CN, slip number, tracking id - one thing under many names. */
  tracking_number varchar(60),

  /* Our vocabulary. The only status the app ever branches on. */
  status          varchar(30) not null default 'pending',

  /* Theirs, verbatim, so an unmapped value is still visible. */
  courier_status  text,

  cod_amount      numeric(10,2) not null default 0,
  weight_grams    integer,
  label_url       text,

  /*
   * The exact payloads. When a COD reconciliation is disputed
   * months later, what was actually sent and returned is the
   * only evidence there is - and no normalised column survives
   * a courier changing its response shape.
   */
  raw_request     jsonb,
  raw_response    jsonb,

  booked_at       timestamptz,
  delivered_at    timestamptz,

  /*
   * When the customer was told their parcel is on its way.
   *
   * Null means they have not been told yet, which is what makes
   * the email retryable: a booking that succeeded while the
   * mailer was down can be chased later without guessing
   * whether it already went out, and re-running the notifier
   * cannot mail the same person twice.
   */
  customer_notified_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint shipments_status_check check (status in (
    'pending', 'booked', 'in_transit', 'out_for_delivery',
    'delivered', 'returned', 'cancelled', 'failed'
  )),

  /* A tracking number is unique within a courier, not across. */
  constraint shipments_tracking_unique unique (courier_code, tracking_number)
);

create index if not exists shipments_order_idx on public.shipments (order_id);
create index if not exists shipments_status_idx on public.shipments (status);

/*
 * One live shipment per order. A cancelled or returned one may
 * sit beside its replacement, but two active bookings for the
 * same parcel is a double charge waiting to happen.
 */
create unique index if not exists shipments_one_active_per_order
  on public.shipments (order_id)
  where status not in ('cancelled', 'returned', 'failed');

-- ---------------------------------------------------------
-- Shipment history
-- ---------------------------------------------------------
--
-- Every status the courier reported, in order. Also what makes
-- a webhook idempotent: the same event arriving twice is the
-- same row, not a second one.

create table if not exists public.shipment_events (
  id             uuid primary key default gen_random_uuid(),
  shipment_id    uuid        not null references public.shipments(id) on delete cascade,
  status         varchar(30) not null,
  courier_status text,
  occurred_at    timestamptz not null default now(),
  raw            jsonb,
  created_at     timestamptz default now(),

  constraint shipment_events_unique unique (shipment_id, courier_status, occurred_at)
);

create index if not exists shipment_events_shipment_idx
  on public.shipment_events (shipment_id, occurred_at desc);

-- ---------------------------------------------------------
-- orders.tracking_number stays, and stays correct
-- ---------------------------------------------------------
--
-- The column already exists, track_order() reads it, and the
-- admin list shows it. Deleting it would break the customer's
-- tracking page; leaving it to be set by hand would let it
-- disagree with the shipment that owns it - which is how an
-- order ends up marked delivered while its parcel says
-- returned.
--
-- So it becomes a mirror, maintained here rather than trusted.

create or replace function public.sync_order_tracking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders o
     set tracking_number = new.tracking_number,
         status = case
                    when new.status = 'delivered' then 'delivered'
                    when new.status = 'returned'  then 'returned'
                    /* Anything else leaves the order's own workflow alone. */
                    else o.status
                  end,
         updated_at = now()
   where o.id = new.order_id;

  return new;
end;
$$;

drop trigger if exists shipments_sync_order on public.shipments;

create trigger shipments_sync_order
  after insert or update of tracking_number, status on public.shipments
  for each row execute function public.sync_order_tracking();

-- ---------------------------------------------------------
-- Access
-- ---------------------------------------------------------
--
-- Everything here is back-office. A shopper never reads these
-- tables directly: their tracking page goes through
-- track_order(), which is SECURITY DEFINER and returns only the
-- one order they can already identify.
--
-- couriers is the exception - the storefront may want to name
-- the courier at checkout - so its enabled rows are public,
-- and `config` is not secret by construction.

alter table public.couriers            enable row level security;
alter table public.courier_cities      enable row level security;
alter table public.courier_status_map  enable row level security;
alter table public.shipments           enable row level security;
alter table public.shipment_events     enable row level security;

drop policy if exists "couriers_public_read" on public.couriers;
create policy "couriers_public_read" on public.couriers
  for select using (enabled);

drop policy if exists "couriers_admin_manage" on public.couriers;
create policy "couriers_admin_manage" on public.couriers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "courier_cities_admin" on public.courier_cities;
create policy "courier_cities_admin" on public.courier_cities
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "courier_status_map_admin" on public.courier_status_map;
create policy "courier_status_map_admin" on public.courier_status_map
  for all using (public.is_admin()) with check (public.is_admin());

/*
 * No public read on shipments. It carries the customer's COD
 * amount and the courier's raw payload, which includes their
 * address and phone number.
 */
drop policy if exists "shipments_admin" on public.shipments;
create policy "shipments_admin" on public.shipments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "shipment_events_admin" on public.shipment_events;
create policy "shipment_events_admin" on public.shipment_events
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- Seed the three couriers, disabled
-- ---------------------------------------------------------
--
-- Present so the admin can switch one on, off by default so
-- nothing books against an account that has no credentials yet.

insert into public.couriers (code, name, supports_cod, sort_order) values
  ('leopards', 'Leopards Courier', true, 1),
  ('postex',   'PostEx',           true, 2),
  ('mp',       'M&P',              true, 3)
on conflict (code) do nothing;

/*
 * Leopards' own words, from its tracking API. The others are
 * left empty on purpose: mapping a vocabulary nobody has seen
 * is guessing, and a wrong guess here silently marks parcels
 * delivered.
 */
insert into public.courier_status_map (courier_code, courier_status, status) values
  ('leopards', 'booked',              'booked'),
  ('leopards', 'pickup request sent', 'booked'),
  ('leopards', 'picked up',           'in_transit'),
  ('leopards', 'in transit',          'in_transit'),
  ('leopards', 'arrived at station',  'in_transit'),
  ('leopards', 'out for delivery',    'out_for_delivery'),
  ('leopards', 'delivered',           'delivered'),
  ('leopards', 'returned to shipper', 'returned'),
  ('leopards', 'return to shipper',   'returned'),
  ('leopards', 'cancelled',           'cancelled')
on conflict (courier_code, courier_status) do nothing;
