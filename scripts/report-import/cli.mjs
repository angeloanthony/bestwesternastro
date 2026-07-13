// CLI orchestration — read path (M6 · Phase D, T10 arg parsing + T11 read-path wiring).
//
// Wires the command line to the read pipeline: parse args → load CSV → parser → transform
// → validate → summary. It performs NO database work: no duplicate detection, no dry-run
// persistence, no writes, no matching, no commission math. Those are later tasks.
//
// Everything here is pure and injectable so it can be unit-tested without a filesystem,
// a database, or a real partner profile:
//   * `readFile(path) -> string`   — supplied by the entry point (fs) or a test double.
//   * `resolveProfile(slug) -> profile|null` — supplied by the entry point. The real
//       partner registry is T04 (profiles.mjs); until then the entry passes a resolver
//       that returns null, and tests pass a mock profile.
// runImport returns { code, stdout, stderr } and never touches process/console itself.

import { parseArgs } from 'node:util';

import { readCsv, transformToCanonical } from './parser.mjs';
import { validateRecords } from './validate.mjs';

/** Exit codes. Non-zero for any usage, I/O, or fatal-validation failure. */
export const EXIT = Object.freeze({
  SUCCESS: 0,
  VALIDATION_FAILED: 1,
  RUNTIME_ERROR: 1, // unknown profile / unreadable file
  USAGE: 2,
});

export const USAGE = `partner report CSV importer (M6) — read path (parse + validate)

Usage:
  npm run report:import -- --partner <slug> --period <YYYY-MM> --file <path> [options]

Required:
  --partner <slug>      partner registry slug, e.g. best-western-vernal
  --period <YYYY-MM>    report month; expands to period_start/period_end
  --file <path>         CSV to read (drop into reports/inbox/, which is gitignored)

Options:
  --source-note <text>  free-text note (stored on the report header at persistence time)
  --operator <name>     who ran the import (reconciled_by, at persistence time)
  -h, --help            show this help

This command currently reads and validates only — it makes NO database writes.`;

/**
 * Expand a `YYYY-MM` month into inclusive ISO day bounds.
 * @param {string} period
 * @returns {{ period_start: string, period_end: string }|null} null if not a valid month.
 */
export function expandPeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  // Day 0 of the next (1-based) month === last day of this month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    period_start: `${year}-${mm}-01`,
    period_end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Parse and validate CLI arguments.
 * @param {string[]} argv Arguments after the node script name (i.e. process.argv.slice(2)).
 * @returns {{ values: Object, errors: string[], help: boolean,
 *            periodBounds: {period_start:string,period_end:string}|null }}
 */
export function parseCliArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        partner: { type: 'string' },
        period: { type: 'string' },
        file: { type: 'string' },
        'source-note': { type: 'string' },
        operator: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: false,
      strict: true,
    });
  } catch (e) {
    return { values: {}, errors: [e.message], help: false, periodBounds: null };
  }

  const values = parsed.values;
  if (values.help) {
    return { values, errors: [], help: true, periodBounds: null };
  }

  const errors = [];
  if (!values.partner) errors.push('missing required --partner <slug>');
  if (!values.file) errors.push('missing required --file <path>');

  let periodBounds = null;
  if (!values.period) {
    errors.push('missing required --period <YYYY-MM>');
  } else {
    periodBounds = expandPeriod(values.period);
    if (!periodBounds) errors.push(`invalid --period '${values.period}' (expected YYYY-MM)`);
  }

  return { values, errors, help: false, periodBounds };
}

const issueLine = (i) => `    row ${i.row} · ${i.field} · ${i.code} — ${i.message}`;

/**
 * Render a human-readable validation summary.
 * @param {Object} args
 * @param {string} args.partner
 * @param {string} args.period
 * @param {{period_start:string,period_end:string}} args.bounds
 * @param {string} args.file
 * @param {import('./parser.mjs').CsvDocument} args.csvDoc
 * @param {import('./validate.mjs').Manifest} args.manifest
 * @returns {string}
 */
export function formatSummary({ partner, period, bounds, file, csvDoc, manifest }) {
  const lines = [];
  lines.push('Partner report import — validation summary');
  lines.push(`  partner : ${partner}`);
  lines.push(`  period  : ${period} (${bounds.period_start} → ${bounds.period_end})`);
  lines.push(`  file    : ${file}`);
  lines.push(`  parsed  : ${csvDoc.rows.length} data row(s), ${csvDoc.columnCount} column(s)`);
  if (csvDoc.ragged.length > 0) {
    lines.push(`  ragged  : ${csvDoc.ragged.length} row(s) with an unexpected column count`);
  }
  if (csvDoc.rows.length === 0) {
    lines.push('  note    : no data rows found in file');
  }
  lines.push('  ----');

  lines.push(`  errors  : ${manifest.errors.length} fatal`);
  for (const i of manifest.errors) lines.push(issueLine(i));
  lines.push(`  warnings: ${manifest.warnings.length}`);
  for (const i of manifest.warnings) lines.push(issueLine(i));
  lines.push('  ----');

  lines.push(
    manifest.ok
      ? `  RESULT: OK — ${csvDoc.rows.length} row(s) passed validation. No writes performed.`
      : `  RESULT: FAIL — ${manifest.errors.length} fatal error(s). Not eligible for import.`
  );
  return lines.join('\n');
}

/**
 * Run the read-path import: parse args, load the CSV, run it through parser → transform →
 * validate, and produce a summary. No persistence of any kind.
 *
 * @param {string[]} argv
 * @param {Object} deps
 * @param {(path: string) => string} deps.readFile        Reads a file to a string.
 * @param {(slug: string) => (Object|null)} deps.resolveProfile Resolves a partner profile.
 * @returns {{ code: number, stdout: string, stderr: string }}
 */
export function runImport(argv, { readFile, resolveProfile }) {
  const { values, errors, help, periodBounds } = parseCliArgs(argv);

  if (help) {
    return { code: EXIT.SUCCESS, stdout: USAGE, stderr: '' };
  }
  if (errors.length > 0) {
    return {
      code: EXIT.USAGE,
      stdout: '',
      stderr: `${USAGE}\n\n${errors.map((e) => `error: ${e}`).join('\n')}`,
    };
  }

  const { partner, period, file } = values;

  const profile = resolveProfile(partner);
  if (!profile) {
    return {
      code: EXIT.RUNTIME_ERROR,
      stdout: '',
      stderr: `error: no profile registered for partner '${partner}'. Partner profiles are built in T04 (profiles.mjs).`,
    };
  }

  let text;
  try {
    text = readFile(file);
  } catch (e) {
    return {
      code: EXIT.RUNTIME_ERROR,
      stdout: '',
      stderr: `error: cannot read file '${file}': ${e.message}`,
    };
  }

  const csvDoc = readCsv(text);
  const records = transformToCanonical(csvDoc, profile);
  const manifest = validateRecords(records);
  const summary = formatSummary({ partner, period, bounds: periodBounds, file, csvDoc, manifest });

  return {
    code: manifest.ok ? EXIT.SUCCESS : EXIT.VALIDATION_FAILED,
    stdout: summary,
    stderr: '',
  };
}
