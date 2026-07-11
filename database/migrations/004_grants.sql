-- ============================================================================
-- AdventureOS — Migration 004: Table privileges (grant baseline)
-- Discovered during Infrastructure Verification (M1). The application tables
-- did NOT inherit the project's default privileges (owner=postgres, default
-- ACL granted anon/authenticated arwdDxtm, yet the tables carried only
-- REFERENCES/TRIGGER/TRUNCATE). With no DML privilege, every RLS policy from
-- 002 was unreachable — Postgres returns "permission denied" BEFORE it ever
-- evaluates a policy. This migration states the privilege baseline EXPLICITLY
-- so correctness no longer depends on default-privilege inheritance.
--
-- Model: RLS (002) is the ROW gate; GRANT is the coarse TABLE gate. We grant
-- broadly only where RLS — or a deliberate read-only choice — protects the
-- data. Tables WITHOUT RLS (destination, location_edge, partner) get SELECT
-- only, never write, so anon can never mutate an unprotected table.
-- GRANT is additive and idempotent — safe to re-run.
-- ============================================================================

-- Schema visibility (no-op if already present; keeps this migration standalone).
grant usage on schema public to anon, authenticated;

-- ── Public reads ───────────────────────────────────────────────────────────
-- RLS-filtered public content (RLS restricts WHICH rows anon sees):
grant select on location to anon, authenticated;   -- RLS: published only
grant select on event    to anon, authenticated;   -- RLS: published only
grant select on offer    to anon, authenticated;   -- RLS: active only

-- Public reference tables WITHOUT RLS — all rows public, read-only:
grant select on destination   to anon, authenticated;
grant select on location_edge to anon, authenticated;

-- ── Lead capture (corporate rate form — revenue critical) ──────────────────
-- anon may INSERT (public form). SELECT is granted too so that RLS (lead has
-- NO select policy → default-deny) returns ZERO rows rather than "permission
-- denied": that is what keeps submitted leads private while still letting the
-- query execute (rls_checks.sql test #3 depends on this). No update/delete.
grant select, insert on lead to anon, authenticated;

-- ── Member-owned data (Adventure Pass — RLS: own rows only) ────────────────
-- Completes the baseline the 002 prof_own / itin_own policies assume. Only
-- exercised once authenticated sessions exist (M2 / Prompt 5); harmless now.
grant select, insert, update, delete on member_profile to authenticated;
grant select, insert, update, delete on itinerary      to authenticated;

-- ── Trusted backend ────────────────────────────────────────────────────────
-- service_role runs staff/server operations and bypasses RLS in Supabase.
-- Scoped to the AdventureOS tables (NOT `all tables in schema public`) so we
-- never touch extension-owned tables. Granted explicitly because the same
-- inheritance gap that stripped anon/authenticated likely stripped this role
-- too — we don't assume it "already works".
grant all on
  destination, location, location_edge, member_profile,
  itinerary, partner, offer, event, lead
to service_role;

-- NOTE: `partner` is intentionally NOT granted to anon/authenticated. It has
-- no RLS and holds contact PII (contact_email / contact_name); a base-table
-- SELECT grant would expose that to the public anon role. If public offer
-- display needs partner business names, expose them via a dedicated view (or
-- add RLS to partner) — do not blanket-grant SELECT on the base table.
