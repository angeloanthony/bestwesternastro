-- ============================================================================
-- AdventureOS — Migration 008: Booking-intent journey snapshot (M7)
-- Additive ONLY. Completes the "immutable journey snapshot" (M7 Phase 3): what
-- the visitor had going for them AT REFERRAL TIME, frozen on the click row. The
-- provenance columns (utm/referrer/device/checkin/checkout/landing_page) and the
-- member linkage (user_id/itinerary_id) already exist in 006; this adds the three
-- member-context fields the interstitial can capture but 006 didn't carry.
--
-- Immutability is NOT a new rule here — it is already enforced by the 006 grant
-- model: anon/authenticated hold SELECT+INSERT only (no UPDATE/DELETE), so a
-- booking_intent row cannot be mutated from the browser once written. These
-- columns are set once, at insert.
--
-- All three are NOT NULL with a default, so the additive change is safe for the
-- (zero) existing rows and for any direct-SQL insert. Idempotent. Apply after
-- 001–007 with: supabase db push (or psql -f).
-- ============================================================================

-- Saved attractions (favorite.attraction_slug values) the member had saved when
-- they clicked out. Empty for anonymous clicks. Slug-keyed, matching the rest of
-- the attribution spine (partner_slug, attraction_slug) — no FK.
alter table booking_intent add column if not exists saved_slugs   text[]  not null default '{}';

-- Interest tags from member_profile.interests at click time (empty for anon).
alter table booking_intent add column if not exists interests     text[]  not null default '{}';

-- Did the member have a generated itinerary when they clicked? (Distinct from
-- itinerary_id, which links the specific plan; this is the cheap boolean the
-- dashboard groups on.) False for anonymous clicks.
alter table booking_intent add column if not exists has_itinerary boolean not null default false;
