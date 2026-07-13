// Partner report CSV importer — entry point (M6).
//
// Off-browser staff CLI that reads a partner's monthly reservation CSV, validates it
// against the canonical schema, and — unless --dry-run — persists it to the staff-only
// partner_report / partner_report_line tables. Same tooling pattern as
// scripts/booking-report.mjs and scripts/verify-db.mjs: plain .mjs, ESM, Node ≥22.12,
// run with the service-role key.
//
//   PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     npm run report:import -- --partner best-western-vernal --period 2026-06 \
//       --file reports/inbox/june.csv [--replace] [--dry-run]
//
// The write path parses → transforms → validates → dedups (decideImport) → persists every
// line as status='unmatched'. It does NOT match booking_intent or compute commission —
// those are later, deliberately postponed milestones. Exit 0 on success, non-zero otherwise.
//
// All logic lives in report-import/cli.mjs + persist.mjs (pure/injectable + unit-tested);
// this shell supplies real dependencies and turns the result into stdout/stderr + exit code.

import { readFileSync } from 'node:fs';

import { runImport, runWriteImport } from './report-import/cli.mjs';
import {
  createServiceClient,
  persistReport,
  deleteReport,
  fetchReportsForPartner,
} from './report-import/persist.mjs';
import { getProfile } from './report-import/profiles.mjs';

// Partner profile registry (report-import/profiles.mjs). A known `--partner` slug resolves
// to its import profile; an unknown slug returns null and the CLI reports that cleanly
// rather than guessing a mapping.
const resolveProfile = getProfile;

const argv = process.argv.slice(2);
const readFile = (path) => readFileSync(path, 'utf8');

let result;
if (argv.includes('--dry-run')) {
  // Read/validate only — no client, no writes.
  result = runImport(argv, { readFile, resolveProfile });
} else {
  // Write path needs a service-role client for dedup lookups + persistence.
  let client;
  try {
    client = createServiceClient();
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
  result = await runWriteImport(argv, {
    readFile,
    resolveProfile,
    fetchReports: (slug) => fetchReportsForPartner(client, slug),
    persist: (meta, records) => persistReport(client, meta, records),
    remove: (id) => deleteReport(client, id),
  });
}

if (result.stdout) process.stdout.write(`${result.stdout}\n`);
if (result.stderr) process.stderr.write(`${result.stderr}\n`);
process.exit(result.code);
