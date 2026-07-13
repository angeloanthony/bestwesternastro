// Partner report CSV importer — entry point (M6).
//
// Off-browser staff CLI that ingests a partner's monthly reservation CSV into the
// staff-only partner_report / partner_report_line tables. Same tooling pattern as
// scripts/booking-report.mjs and scripts/verify-db.mjs: plain .mjs, ESM, Node ≥22.12,
// run with the service-role key. Unlike those read-only reports this is a WRITE tool —
// it is atomic and aborts on error (not fail-open).
//
// Every imported line lands as status='unmatched'. This tool does NOT match, reconcile,
// or compute commission — that is a later, deliberately postponed milestone.
//
//   PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     npm run report:import -- --partner best-western-vernal --period 2026-06 --file reports/inbox/june.csv
//
// This is the T02 scaffold: a usage stub only. Argument parsing (T10), dry-run
// orchestration (T11), and the write path (T15) are wired in later tasks. See
// docs/M6_CSV_IMPORTER_CHECKLIST.md and docs/M6_CSV_IMPORTER.md.

const USAGE = `partner report CSV importer (M6) — not yet implemented

Usage:
  npm run report:import -- --partner <slug> --period <YYYY-MM> --file <path> [options]

Options (parsed in T10 — listed here for reference):
  --partner <slug>      partner registry slug, e.g. best-western-vernal
  --period <YYYY-MM>    report month; expands to period_start/period_end
  --file <path>         CSV to import (drop into reports/inbox/, which is gitignored)
  --source-note <text>  free-text note stored on the report header
  --operator <name>     who ran the import (reconciled_by)
  --dry-run             parse + validate only; make no writes
  --replace             supersede a prior report for the same partner+period

Environment:
  PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (service-role key — server secret)

This is a scaffold stub. It performs no import yet; run the checklist tasks to build it.`;

// Usage stub: always print usage and exit non-zero until the CLI is implemented (T10+).
// Exiting non-zero keeps the stub from ever looking like a successful no-op import.
console.error(USAGE);
process.exit(1);
