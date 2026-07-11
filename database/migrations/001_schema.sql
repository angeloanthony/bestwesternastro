-- ============================================================================
-- AdventureOS — Migration 001: Schema (tables, enums, indexes)
-- Destination-agnostic SHAPE, single-tenant (Vernal) REALITY. Per Report §6.
-- Apply with: supabase db push  (or psql -f). Idempotent where practical.
-- ============================================================================

-- Extensions --------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists vector;

-- updated_at helper -------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Destination -------------------------------------------------------------
create table if not exists destination (
  id         uuid primary key default uuid_generate_v4(),
  slug       text unique not null,                 -- 'vernal'
  name       text not null,
  center     geography(point) not null,
  timezone   text not null default 'America/Denver',
  config     jsonb default '{}'::jsonb,            -- branding, feature flags
  created_at timestamptz default now()
);

-- Location — the central entity ------------------------------------------
do $$ begin
  create type location_type as enum (
    'attraction','trailhead','restaurant','fuel','lodging',
    'viewpoint','museum','business','service','event_venue','other'
  );
exception when duplicate_object then null; end $$;

create table if not exists location (
  id                  uuid primary key default uuid_generate_v4(),
  destination_id      uuid not null references destination(id),
  slug                text not null,
  name                text not null,
  type                location_type not null,
  categories          text[] not null default '{}',
  good_for            text[] not null default '{}',
  ai_summary          text not null,               -- 200-400 chars, factual
  description_full    text,                         -- markdown
  gps                 geography(point) not null,
  address             text,
  phone               text,
  website             text,
  hours               jsonb,                        -- see docs/HOURS_SCHEMA note
  price_range         text check (price_range in ('free','$','$$','$$$','$$$$')),
  truck_parking       boolean default false,
  truck_parking_notes text,
  cell_coverage       text check (cell_coverage in ('none','spotty','good','excellent')),
  accessibility       jsonb default '{}'::jsonb,
  crowd_level         text check (crowd_level in ('low','medium','high')),
  crowd_notes         text,
  seasonal_notes      text,
  images              jsonb default '[]'::jsonb,    -- [{url, alt, credit, rights}]
  downloadable_guide_url text,
  embedding           vector(1024),                 -- RAG retrieval
  -- Governance (added vs. the original spec) ------------------------------
  owner_user_id       uuid references auth.users(id),
  status              text not null default 'draft'
                        check (status in ('draft','published','archived')),
  last_verified       timestamptz not null default now(),
  verified_by         uuid references auth.users(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (destination_id, slug)
);

create index if not exists location_gps_idx        on location using gist (gps);
create index if not exists location_categories_idx on location using gin (categories);
create index if not exists location_goodfor_idx    on location using gin (good_for);
create index if not exists location_embedding_idx  on location using hnsw (embedding vector_cosine_ops);
create index if not exists location_fts_idx        on location using gin (to_tsvector('english', name || ' ' || ai_summary));

drop trigger if exists location_set_updated_at on location;
create trigger location_set_updated_at before update on location
  for each row execute function set_updated_at();

-- Relationship graph ------------------------------------------------------
do $$ begin
  create type rel_type as enum (
    'near','part_of','recommended_for','suitable_for',
    'has_offer','open_during','requires','hosts','alternative_to'
  );
exception when duplicate_object then null; end $$;

create table if not exists location_edge (
  id         uuid primary key default uuid_generate_v4(),
  from_id    uuid not null references location(id) on delete cascade,
  to_id      uuid references location(id) on delete cascade,
  to_ref     text,                                  -- non-location targets (user_type, season)
  rel        rel_type not null,
  weight     real default 1.0,
  note       text,
  created_at timestamptz default now()
);
create index if not exists edge_from_idx on location_edge (from_id, rel);
create index if not exists edge_to_idx   on location_edge (to_id, rel);

-- Member profile (extends Supabase auth.users) ---------------------------
create table if not exists member_profile (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  destination_id uuid not null references destination(id),
  display_name   text,
  user_types     text[] not null default '{tourist}',
  interests      text[] default '{}',
  visit_reason   text,
  arrival_date   date,
  departure_date date,
  member_since   timestamptz default now(),
  marketing_optin boolean default false,            -- explicit, unchecked by default
  created_at     timestamptz default now()
);

create table if not exists itinerary (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  start_date date,
  days       jsonb not null,                        -- [{day, stops:[{location_id,time,note}]}]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
drop trigger if exists itinerary_set_updated_at on itinerary;
create trigger itinerary_set_updated_at before update on itinerary
  for each row execute function set_updated_at();

-- Partner / Offer / Event (partner minimal in v1) ------------------------
create table if not exists partner (
  id             uuid primary key default uuid_generate_v4(),
  destination_id uuid not null references destination(id),
  location_id    uuid references location(id),
  business_name  text not null,
  contact_email  text,
  contact_name   text,
  status         text default 'active'
                   check (status in ('active','paused','pending','suspended')),
  created_at     timestamptz default now()
);

create table if not exists offer (
  id          uuid primary key default uuid_generate_v4(),
  partner_id  uuid not null references partner(id) on delete cascade,
  location_id uuid references location(id),
  title       text not null,
  terms       text,
  valid_from  date,
  valid_to    date,
  redeem_how  text default 'Show your Adventure Pass card at checkout',
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists event (
  id             uuid primary key default uuid_generate_v4(),
  destination_id uuid not null references destination(id),
  location_id    uuid references location(id),
  name           text not null,
  ai_summary     text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  categories     text[] default '{}',
  good_for       text[] default '{}',
  ticket_url     text,
  status         text default 'published',
  last_verified  timestamptz default now()
);

-- Lead capture (corporate rate requests, room blocks) — REVENUE CRITICAL --
create table if not exists lead (
  id           uuid primary key default uuid_generate_v4(),
  kind         text not null,                       -- corporate_rate|room_block|group|general
  company      text,
  contact_name text not null,
  email        text not null,
  phone        text,
  rooms        int,
  nights       int,
  arrival      date,
  notes        text,
  source_page  text,                                -- which page drove it
  status       text default 'new',
  created_at   timestamptz default now()
);
