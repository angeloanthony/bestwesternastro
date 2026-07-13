// Reconciliation matcher — entry point (M8).
//
// Off-browser staff CLI that links imported partner_report_line rows (M6) to booking_intent
// clicks (006), advancing each matched intent to its observed outcome (stayed/cancelled) and
// filling revenue, room nights, and commission. Same tooling pattern as scripts/import-report.mjs
// and scripts/verify-db.mjs: plain .mjs, ESM, Node ≥22.12, run with the service-role key.
//
//   PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     npm run reconcile:run -- --partner best-western-vernal [--period 2026-06] [--dry-run]
//
// All logic lives in reconcile/*.mjs (pure/injectable + unit-tested); this shell supplies the
// real service-role client, the clock, and the aging cutoff, then turns the result into
// stdout/stderr + an exit code. --dry-run performs zero writes. Exit 0 on success.

import { runReconcile } from './reconcile/cli.mjs';
import {
  createServiceClient,
  fetchUnmatchedLines,
  fetchMatchableIntents,
  fetchCommissionPercent,
  applyReconciliation,
  ageUnmatchedIntents,
} from './reconcile/persist.mjs';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

// --dry-run still reads (to compute the plan), so it needs a client too — it just never writes.
let client;
try {
  client = createServiceClient();
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}

const now = () => new Date().toISOString();
const cutoffFor = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

const result = await runReconcile(argv, {
  fetchLines: (args) => fetchUnmatchedLines(client, args),
  fetchIntents: (args) => fetchMatchableIntents(client, args),
  fetchCommission: (slug) => fetchCommissionPercent(client, slug),
  apply: (plan, opts) => applyReconciliation(client, plan, { ...opts, dryRun }),
  age: (args) => ageUnmatchedIntents(client, args),
  now,
  cutoffFor,
});

if (result.stdout) process.stdout.write(`${result.stdout}\n`);
if (result.stderr) process.stderr.write(`${result.stderr}\n`);
process.exit(result.code);
