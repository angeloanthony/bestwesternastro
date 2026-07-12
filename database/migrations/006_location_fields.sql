-- ============================================================================
-- AdventureOS — Migration 006: Location catalogue fields (M6 — Knowledge Base)
-- Additive ONLY. Adds the columns the Adventure Pass catalogue needs so the
-- `location` table can fully replace src/data/attractions.ts (ADR-007 migration
-- path). Nothing existing is altered or dropped: every column below is new and
-- either nullable or has a default, so applying this leaves all M1–M5 data and
-- the `location` shape from 001 intact.
--
-- Field mapping (M6 Location model → column):
--   short_description        → ai_summary        (already in 001, NOT NULL)
--   long_description         → description_full  (already in 001)
--   coordinates              → gps               (already in 001, NOT NULL)
--   interests                → good_for          (already in 001)
--   seasonality              → seasonal_notes    (already in 001)
--   estimated_visit_time     → visit_duration    (added here)
--   drive_time               → drive_minutes     (added here)
--   everything else          → added here
--
-- Idempotent (add column if not exists). Apply after 001–005 with:
--   supabase db push   (or psql -f)
-- ============================================================================

alter table location add column if not exists emoji                text;
alter table location add column if not exists area                 text
  check (area in ('in-town','nearby','day-trip'));
alter table location add column if not exists drive_minutes        int;
alter table location add column if not exists visit_duration       text
  check (visit_duration in ('quick','half-day','full-day'));
alter table location add column if not exists difficulty           text
  check (difficulty in ('easy','moderate','strenuous'));
alter table location add column if not exists family_friendly      boolean not null default false;
alter table location add column if not exists pet_friendly         boolean not null default false;
alter table location add column if not exists wheelchair_accessible boolean not null default false;
alter table location add column if not exists booking_url          text;
alter table location add column if not exists tags                 text[] not null default '{}';
alter table location add column if not exists priority             int;
alter table location add column if not exists featured             boolean not null default false;
-- Where the catalogue's "Learn more" points. Internal .html path to an existing
-- on-site page (never a NEW url) — keeps the ADR-002 flat-URL contract intact.
alter table location add column if not exists learn_more_href      text;

-- Ranking helper: the planner/browser order by editorial priority (1 = highest).
create index if not exists location_priority_idx on location (destination_id, priority);
create index if not exists location_featured_idx on location (destination_id) where featured;
