-- ============================================================================
-- AdventureOS — Migration 006: Booking attribution spine (REVENUE CRITICAL)
-- The outbound half of the funnel. `lead` (001) captures high-intent FORM fills
-- (corporate rate / room block). This captures the OTHER path: a visitor clicking
-- "Book Now" and leaving for a booking engine we cannot see server-side. We route
-- every such click through /go first, mint a per-click ref code, record the intent
-- here, THEN redirect. Attribution is then closed monthly against the partner's
-- report (see `hotel_report`), not via a conversion pixel we don't control.
--
-- Design (deliberately lean — one hotel, zero recorded stays today):
--   * NO commission / trip / attribution side-tables, NO 8-state pipeline. The
--     `itinerary` table (001) already IS the "trip"; a member's click links to it.
--   * `partner_slug text` not a partner FK — the SAME slug-not-FK choice made for
--     favorite.attraction_slug (005): the `partner` table is minimal/empty, slugs
--     (src/data/partners.ts) are the stable contract. Migrate to a partner.slug FK
--     later without data loss.
--   * status uses the 5 states we can actually observe, not a speculative CRM.
--
-- Self-contained in the 002/004/005 style: table + RLS + grants together.
-- Idempotent — safe to re-run. Apply after 001–005 with: supabase db push.
-- ============================================================================

-- Give `partner` (001) the attribution/reconciliation columns. Additive; these
-- are the system-of-record for commission math and the monthly report — the
-- public site reads referral fields from src/data/partners.ts, never this table
-- (partner holds contact PII and is NOT anon-readable — see grant 004 note).
alter table partner add column if not exists slug               text;
alter table partner add column if not exists booking_url        text;
alter table partner add column if not exists promo_code         text;   -- what the guest says at check-in; keys the report
alter table partner add column if not exists ref_prefix         text;   -- human ref-code prefix, e.g. 'BW'
alter table partner add column if not exists commission_percent numeric(5,2);
alter table partner add column if not exists report_email       text;

-- One partner per (destination, slug) once slugs are populated. Partial index so
-- the many existing NULL-slug rows (none today) don't collide.
create unique index if not exists partner_slug_uidx
  on partner (destination_id, slug) where slug is not null;

-- Booking intent — one row per outbound "Book Now" click through /go -----------
create table if not exists booking_intent (
  id            uuid primary key default uuid_generate_v4(),
  partner_slug  text not null,                        -- src/data/partners.ts key (slug-not-FK, per 005)

  -- Attribution keys, best → worst survival through the engine's funnel:
  --   promo_code (guest says it at the desk → appears on the folio/report) is the
  --   load-bearing signal; ref_code (per click) only helps if the URL param
  --   survives AND the engine reports it. The client always supplies ref_code so
  --   the interstitial can show it instantly; this default is a direct-SQL safety net.
  ref_code      text not null unique
                  default upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 10)),
  promo_code    text,                                 -- snapshot of the code shown to this guest

  -- Who / which trip (both null for anonymous clicks). itinerary_id ties a member
  -- click to the exact plan that drove it — the number worth having later.
  user_id       uuid references auth.users(id) on delete set null,
  itinerary_id  uuid references itinerary(id)  on delete set null,

  -- Trip shape passed in the /go query string (all optional).
  checkin       date,
  checkout      date,
  party_size    int,

  -- Provenance.
  landing_page  text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  device        text,

  -- Funnel state — only what we can actually observe. Flips forward during the
  -- monthly reconciliation; unmatched rows age to 'no_match'.
  status        text not null default 'clicked'
                  check (status in ('clicked','confirmed','stayed','no_match','cancelled')),

  -- Reconciliation output (filled from the partner report, nullable until matched).
  matched_at          timestamptz,
  confirmation_number text,
  room_nights         int,
  revenue_cents       int,
  commission_cents    int,
  notes               text,

  created_at    timestamptz default now()
);

create index if not exists booking_intent_created_idx on booking_intent (created_at desc);
create index if not exists booking_intent_status_idx  on booking_intent (status);
create index if not exists booking_intent_partner_idx on booking_intent (partner_slug);

-- RLS — mirrors the `lead` model (002/004): anyone may INSERT (public click),
-- NOBODY may SELECT (no select policy → default-deny). Staff read via service_role,
-- which bypasses RLS. SELECT is still GRANTed below so the anon query returns ZERO
-- rows rather than "permission denied" (same reasoning as lead).
alter table booking_intent enable row level security;

-- One integrity rule beyond lead's: an anonymous click (auth.uid() null) cannot
-- claim a user_id, and a member can only attribute a click to their OWN account.
drop policy if exists bi_insert on booking_intent;
create policy bi_insert on booking_intent for insert
  with check (user_id is null or user_id = auth.uid());

grant select, insert on booking_intent to anon, authenticated;
grant all           on booking_intent to service_role;

-- Monthly reconciliation batches from a partner (staff-only) -------------------
-- Stores the raw CSV so the matcher can be re-run when its logic improves. No
-- anon/authenticated grant and RLS with no policy → reachable ONLY via service_role.
create table if not exists hotel_report (
  id            uuid primary key default uuid_generate_v4(),
  partner_slug  text not null,
  period_start  date,
  period_end    date,
  received_at   timestamptz default now(),
  source_note   text,
  raw_csv       text,
  reconciled_by text
);

alter table hotel_report enable row level security;  -- no policy: default-deny for anon/auth
grant all on hotel_report to service_role;
