-- ============================================================================
-- AdventureOS — Migration 010: Reconciliation (matcher milestone, M8)
-- The matcher (scripts/reconcile/*, npm run reconcile:run) links a partner_report_line
-- (009) to a booking_intent (006), advancing the intent to its observed outcome (stayed /
-- cancelled) and filling the reconciliation columns booking_intent already has
-- (matched_at, confirmation_number, room_nights, revenue_cents, commission_cents, notes).
--
-- This migration only widens partner_report_line's lifecycle and adds the matcher-oriented
-- indexes that 009 deliberately deferred to "the matcher milestone". It is:
--   * ADDITIVE — no column/table is dropped or renamed; booking_intent already carries every
--     reconciliation output column (006), so nothing changes there.
--   * IDEMPOTENT — safe to re-run (drop-if-exists on the check, create-index-if-not-exists).
-- Depends on 006 (booking_intent) and 009 (partner_report_line) already applied.
-- Apply with: supabase db push.
-- ============================================================================

-- Widen the line lifecycle: add 'ambiguous' — a line that matched more than one candidate
-- intent on a strong signal and was left for a human to resolve (never auto-matched). The
-- importer still only ever writes 'unmatched'; the matcher owns 'matched'/'ambiguous'.
alter table partner_report_line drop constraint if exists partner_report_line_status_check;
alter table partner_report_line
  add constraint partner_report_line_status_check
  check (status in ('unmatched', 'matched', 'ambiguous'));

-- Matcher-oriented indexes (009 deferred these to this milestone): the matcher fetches the
-- unmatched lines for a partner (status, partner_slug) and links by booking_intent_id.
create index if not exists partner_report_line_status_idx  on partner_report_line (status);
create index if not exists partner_report_line_partner_idx on partner_report_line (partner_slug);
create index if not exists partner_report_line_intent_idx  on partner_report_line (booking_intent_id);

-- Never double-match: one booking_intent can be linked by at most one report line. Partial
-- so the many NULL (unmatched) rows don't collide. This is the DB-level backstop behind the
-- matcher's own in-memory "one intent → one line" rule.
create unique index if not exists partner_report_line_intent_uidx
  on partner_report_line (booking_intent_id) where booking_intent_id is not null;

-- No grant changes: partner_report_line and booking_intent stay service_role-only (009/006).
-- The matcher runs off-browser with the service-role key, exactly like the importer.
