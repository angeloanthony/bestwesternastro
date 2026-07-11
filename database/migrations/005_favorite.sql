-- ============================================================================
-- AdventureOS — Migration 005: Saved Adventures (favorites) — M4
-- The ONE additive migration for the Itinerary milestone. Adds a single join
-- table so an Adventure Pass member can save attractions. Nothing existing is
-- altered: the trip planner reuses `member_profile` (arrival_date /
-- departure_date / interests) and `itinerary` (days jsonb) from 001 — no new
-- columns, no schema redesign.
--
-- Self-contained in the 002/004 style: table + RLS (own rows) + grants live
-- together so applying this one file is complete. Idempotent — safe to re-run.
-- Apply after 001–004 with: supabase db push (or psql -f).
-- ============================================================================

-- Saved Adventure ----------------------------------------------------------
-- Keyed by attraction SLUG (text), not a location FK: the `location` table is
-- the not-yet-built Knowledge Base track and is intentionally empty. Slugs are
-- the stable contract in src/data/attractions.ts. When `location` is later
-- seeded with matching slugs, this can migrate to a location_id FK without data
-- loss (map slug -> location.id, backfill, then swap the column).
create table if not exists favorite (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  attraction_slug text not null,
  created_at      timestamptz default now(),
  unique (user_id, attraction_slug)   -- one save per member per attraction
);

create index if not exists favorite_user_idx on favorite (user_id);

-- RLS: a member reads/writes ONLY their own saves (mirrors prof_own / itin_own).
alter table favorite enable row level security;

drop policy if exists fav_own on favorite;
create policy fav_own on favorite for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Table-level privilege baseline (the 004 model: RLS is the row gate, GRANT is
-- the coarse table gate). Members are authenticated; anon gets nothing here.
grant select, insert, update, delete on favorite to authenticated;
grant all on favorite to service_role;
