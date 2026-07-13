// Partner report CSV importer — entry point (M6).
//
// Off-browser staff CLI that reads a partner's monthly reservation CSV and validates it
// against the canonical schema. Same tooling pattern as scripts/booking-report.mjs and
// scripts/verify-db.mjs: plain .mjs, ESM, Node ≥22.12.
//
//   npm run report:import -- --partner best-western-vernal --period 2026-06 \
//     --file reports/inbox/june.csv
//
// This is the Phase D read path: parse args → load CSV → parser → transform → validate →
// print a summary. It performs NO database writes, no duplicate detection, and no matching
// — those are later tasks (T09, T12–T15). Exit 0 on clean validation, non-zero otherwise.
//
// All logic lives in report-import/cli.mjs (pure + unit-tested); this shell only supplies
// real dependencies and turns the result into stdout/stderr + an exit code.

import { readFileSync } from 'node:fs';

import { runImport } from './report-import/cli.mjs';

// Partner profile registry is built at T04 (report-import/profiles.mjs). Until then no
// partner resolves and the CLI reports that cleanly rather than guessing a mapping.
const resolveProfile = () => null;

const result = runImport(process.argv.slice(2), {
  readFile: (path) => readFileSync(path, 'utf8'),
  resolveProfile,
});

if (result.stdout) process.stdout.write(`${result.stdout}\n`);
if (result.stderr) process.stderr.write(`${result.stderr}\n`);
process.exit(result.code);
