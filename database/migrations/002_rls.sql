-- ============================================================================
-- AdventureOS — Migration 002: Row Level Security (Report §6)
-- Set on day one — retrofitting RLS after data exists is painful and error-prone.
-- ============================================================================

alter table location       enable row level security;
alter table member_profile enable row level security;
alter table itinerary      enable row level security;
alter table lead           enable row level security;
alter table event          enable row level security;
alter table offer          enable row level security;

-- Public may read only PUBLISHED locations --------------------------------
drop policy if exists loc_public_read on location;
create policy loc_public_read on location for select
  using (status = 'published');

-- Public may read published events + active offers ------------------------
drop policy if exists event_public_read on event;
create policy event_public_read on event for select
  using (status = 'published');

drop policy if exists offer_public_read on offer;
create policy offer_public_read on offer for select
  using (active = true);

-- Members read/write ONLY their own profile and itineraries ---------------
drop policy if exists prof_own on member_profile;
create policy prof_own on member_profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists itin_own on itinerary;
create policy itin_own on itinerary for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Leads: anyone may INSERT (public rate-request form), nobody may SELECT
-- (staff read via the service role, which bypasses RLS). This is what lets
-- the corporate rate form write directly with the anon key while keeping
-- submitted leads private. -------------------------------------------------
drop policy if exists lead_insert on lead;
create policy lead_insert on lead for insert with check (true);
