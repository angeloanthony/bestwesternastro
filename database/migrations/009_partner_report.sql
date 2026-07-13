-- ============================================================================
-- AdventureOS — Migration 009: Partner report import tables (Phase E precondition)
-- The staff-only landing zone for a partner's monthly reservation CSV. The importer
-- (scripts/report-import/*, npm run report:import) reads + validates a file, then writes
-- a header row here plus one canonical line per CSV row — every line 'unmatched'. It does
-- NOT match, reconcile, or compute commission; those are deliberately later milestones.
--
-- Additive + backward-compatible (per the readiness review): this CREATES new tables
-- rather than renaming. `hotel_report` (006) is left in place and is superseded by
-- `partner_report` — same 8 columns, but partner-type-agnostic in name. No existing
-- object is renamed or dropped, so 006's verification stays valid.
--
-- Self-contained in the 006 style: tables + indexes + RLS + grants together. Idempotent —
-- safe to re-run. Depends on 001 (uuid-ossp, partner) and 006 (booking_intent) already
-- applied. Apply with: supabase db push.
-- ============================================================================

-- Header — one row per imported report file ----------------------------------
-- Generalises hotel_report (006) to be partner-type-agnostic. `source_note` carries the
-- sha256:<hex> file-hash token + import warnings (no dedicated hash column — see
-- scripts/report-import/dedup.mjs); `raw_csv` is the verbatim upload so a future matcher
-- can re-run against the exact bytes.
create table if not exists partner_report (
  id            uuid primary key default uuid_generate_v4(),
  partner_slug  text not null,
  period_start  date,
  period_end    date,
  received_at   timestamptz default now(),
  source_note   text,
  raw_csv       text,
  reconciled_by text
);

-- Lines — one canonical row per CSV data row ---------------------------------
-- Column names mirror the canonical record (scripts/report-import/canonical.mjs) so the
-- importer maps 1:1. booking_intent_id stays NULL until a later matcher links a line to an
-- outbound click; status starts 'unmatched'. NO commission columns — commission is a
-- future, out-of-scope feature.
create table if not exists partner_report_line (
  id                uuid primary key default uuid_generate_v4(),
  report_id         uuid not null references partner_report(id) on delete cascade,
  partner_slug      text not null,
  booking_intent_id uuid references booking_intent(id) on delete set null,  -- NULL until matched

  -- Only the state the importer writes ('unmatched') plus its binary complement. The
  -- matcher milestone owns any richer lifecycle and will widen this check then.
  status            text not null default 'unmatched'
                      check (status in ('unmatched','matched')),

  -- Canonical line fields (coerced upstream by the profile transform).
  external_ref      text,
  customer_name     text,
  promo_code        text,
  service_start     date,
  service_end       date,
  quantity          int,
  unit_label        text,
  revenue_cents     int,
  currency          text,

  raw               jsonb,        -- the original CSV row, retained verbatim for audit / re-run
  created_at        timestamptz default now()
);

-- Only the index Phase E needs: fetch, rollback, and --replace all delete/select lines by
-- their report_id (T13/T14/T15). Matcher-oriented indexes (status, partner_slug,
-- booking_intent_id) are intentionally deferred to that milestone.
create index if not exists partner_report_line_report_idx on partner_report_line (report_id);

-- RLS + grants — staff-only, mirroring hotel_report / booking_intent's staff side.
-- RLS enabled with NO policy → default-deny. Access is GRANTed ONLY to service_role (which
-- bypasses RLS). There is deliberately NO anon/authenticated grant, so the public keys are
-- denied at the privilege layer and can never read guest data (names + raw rows live here).
alter table partner_report      enable row level security;
alter table partner_report_line enable row level security;

grant all on partner_report      to service_role;
grant all on partner_report_line to service_role;
