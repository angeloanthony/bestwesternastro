// CLI orchestration (M6 · Phase D read path + Phase F write path).
//
// Two entry functions, both returning { code, stdout, stderr } and never touching
// process/console themselves:
//   * runImport      — read/dry-run path: parse args → load CSV → parse → transform →
//                      validate → summary. NO database work. (Phase D, T10/T11.)
//   * runWriteImport — write path: the above, then dedup (decideImport) → persist, with
//                      --replace support and a final import summary. (Phase F, T15.)
//
// Everything is injectable so it can be unit-tested without a filesystem, a database, or a
// real partner profile. runWriteImport takes high-level deps (fetchReports/persist/remove)
// so the orchestration logic is tested directly; the persistence primitives they wrap are
// tested in persist.test.mjs. It does NOT match booking_intent or compute commission.

import { parseArgs } from 'node:util';

import { readCsv, transformToCanonical } from './parser.mjs';
import { validateRecords } from './validate.mjs';
import { sha256Hex, formatHashToken, decideImport, DECISION } from './dedup.mjs';

/** Exit codes. Non-zero for any usage, I/O, or fatal-validation failure. */
export const EXIT = Object.freeze({
  SUCCESS: 0,
  VALIDATION_FAILED: 1,
  RUNTIME_ERROR: 1, // unknown profile / unreadable file
  USAGE: 2,
});

export const USAGE = `partner report CSV importer (M6)

Usage:
  npm run report:import -- --partner <slug> --period <YYYY-MM> --file <path> [options]

Required:
  --partner <slug>      partner registry slug, e.g. best-western-vernal
  --period <YYYY-MM>    report month; expands to period_start/period_end
  --file <path>         CSV to read (drop into reports/inbox/, which is gitignored)

Options:
  --operator <name>     who ran the import (reconciled_by)
  --replace             supersede a prior report for the same partner+period
  --dry-run             parse + validate only; make NO database writes
  -h, --help            show this help`;

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
        operator: { type: 'string' },
        replace: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
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
      stderr: `error: no profile registered for partner '${partner}'. Check the partner slug, or register its import profile before running.`,
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

  const { csvDoc, records, manifest } = runPipeline(text, profile);
  const summary = formatSummary({ partner, period, bounds: periodBounds, file, csvDoc, manifest });

  return {
    code: manifest.ok ? EXIT.SUCCESS : EXIT.VALIDATION_FAILED,
    stdout: summary,
    stderr: '',
  };
}

// ── Write path (M6 · Phase F, T15) ───────────────────────────────────────────

/** The shared read pipeline: CSV text + profile → parsed doc, canonical records, manifest. */
function runPipeline(text, profile) {
  const csvDoc = readCsv(text);
  const records = transformToCanonical(csvDoc, profile);
  const manifest = validateRecords(records);
  return { csvDoc, records, manifest };
}

/**
 * Compose the report header's source_note: operator, warning count, and the file hash token
 * (so a re-import of the same bytes is detected next time via dedup).
 */
export function buildSourceNote({ operator, warnings, hash }) {
  const who = operator ? `imported by ${operator}` : 'imported';
  return `${who}; ${warnings} warning(s); ${formatHashToken(hash)}`;
}

/**
 * Render the final write-path import summary. Always shows the six required facts:
 * report_id, rows parsed, rows imported, fatal errors, warnings, and the dedup decision.
 * @param {Object} s
 * @returns {string}
 */
export function formatWriteSummary(s) {
  const { partner, period, bounds, file, csvDoc, manifest, decision, outcome } = s;
  const { report_id = null, imported = 0, replacedCount = 0 } = s;
  const lines = [];
  lines.push('Partner report import — summary');
  lines.push(`  partner : ${partner}`);
  lines.push(`  period  : ${period} (${bounds.period_start} → ${bounds.period_end})`);
  lines.push(`  file    : ${file}`);
  lines.push(`  parsed  : ${csvDoc.rows.length} data row(s)`);
  if (decision) lines.push(`  dedup   : ${decision.decision} — ${decision.reason}`);
  if (replacedCount > 0) lines.push(`  replace : voided ${replacedCount} prior report(s)`);
  lines.push('  ----');
  lines.push(`  report_id : ${report_id ?? '(none — no write performed)'}`);
  lines.push(`  imported  : ${imported} line(s)`);
  lines.push(`  errors    : ${manifest.errors.length} fatal`);
  for (const i of manifest.errors)
    lines.push(`    row ${i.row} · ${i.field} · ${i.code} — ${i.message}`);
  lines.push(`  warnings  : ${manifest.warnings.length}`);
  lines.push('  ----');

  if (outcome === 'validation-failed') {
    lines.push(
      `  RESULT: FAIL — ${manifest.errors.length} fatal error(s). Not eligible for import. No writes performed.`
    );
  } else if (outcome === 'blocked') {
    const hint =
      decision.decision === DECISION.WARN_OVERLAP ? ' Re-run with --replace to supersede.' : '';
    lines.push(`  RESULT: BLOCKED — ${decision.decision}. No writes performed.${hint}`);
  } else {
    const suffix = replacedCount > 0 ? ' (replaced prior report)' : '';
    lines.push(`  RESULT: OK — imported ${imported} row(s) as 'unmatched'${suffix}.`);
  }
  return lines.join('\n');
}

/**
 * Run the full write-path import: parse → transform → validate → dedup → persist.
 * decideImport() runs BEFORE any write. Blocks on block-duplicate / warn-overlap unless
 * --replace is given, in which case the conflicting prior report(s) are voided first.
 *
 * @param {string[]} argv
 * @param {Object} deps
 * @param {(path: string) => string} deps.readFile
 * @param {(slug: string) => (Object|null)} deps.resolveProfile
 * @param {(partner_slug: string) => Promise<Object[]>} deps.fetchReports Existing reports for dedup.
 * @param {(meta: Object, records: Object[]) => Promise<{report_id: string, lineCount: number}>} deps.persist
 * @param {(report_id: string) => Promise<void>} deps.remove Void a prior report (for --replace).
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
export async function runWriteImport(argv, deps) {
  const { readFile, resolveProfile, fetchReports, persist, remove } = deps;
  const { values, errors, help, periodBounds } = parseCliArgs(argv);

  if (help) return { code: EXIT.SUCCESS, stdout: USAGE, stderr: '' };
  if (errors.length > 0) {
    return {
      code: EXIT.USAGE,
      stdout: '',
      stderr: `${USAGE}\n\n${errors.map((e) => `error: ${e}`).join('\n')}`,
    };
  }

  const { partner, period, file } = values;
  const replace = Boolean(values.replace);
  const operator = values.operator ?? null;
  const bounds = periodBounds;

  const profile = resolveProfile(partner);
  if (!profile) {
    return {
      code: EXIT.RUNTIME_ERROR,
      stdout: '',
      stderr: `error: no profile registered for partner '${partner}'. Check the partner slug, or register its import profile before running.`,
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

  const { csvDoc, records, manifest } = runPipeline(text, profile);

  // Fatal validation → never reach dedup or the database.
  if (!manifest.ok) {
    return {
      code: EXIT.VALIDATION_FAILED,
      stdout: formatWriteSummary({
        partner,
        period,
        bounds,
        file,
        csvDoc,
        manifest,
        outcome: 'validation-failed',
      }),
      stderr: '',
    };
  }

  // Dedup decision BEFORE any write.
  const newHash = sha256Hex(text);
  let existing;
  try {
    existing = await fetchReports(partner);
  } catch (e) {
    return {
      code: EXIT.RUNTIME_ERROR,
      stdout: '',
      stderr: `error: cannot read existing reports: ${e.message}`,
    };
  }
  const decision = decideImport(
    {
      newHash,
      partner_slug: partner,
      period_start: bounds.period_start,
      period_end: bounds.period_end,
    },
    existing
  );

  const conflicts = decision.conflicts ?? [];
  if (decision.decision !== DECISION.ALLOW && !replace) {
    return {
      code: EXIT.VALIDATION_FAILED,
      stdout: formatWriteSummary({
        partner,
        period,
        bounds,
        file,
        csvDoc,
        manifest,
        decision,
        outcome: 'blocked',
      }),
      stderr: '',
    };
  }

  // --replace: void conflicting prior report(s) first (cascade removes their lines).
  let replacedCount = 0;
  if (replace && conflicts.length > 0) {
    const ids = [...new Set(conflicts.map((c) => c.report?.id).filter(Boolean))];
    try {
      for (const id of ids) {
        await remove(id);
        replacedCount += 1;
      }
    } catch (e) {
      return {
        code: EXIT.RUNTIME_ERROR,
        stdout: '',
        stderr: `error: --replace failed to void a prior report: ${e.message}`,
      };
    }
  }

  // Persist header + lines (atomic; rolls back internally on line failure).
  const meta = {
    partner_slug: partner,
    period_start: bounds.period_start,
    period_end: bounds.period_end,
    source_note: buildSourceNote({ operator, warnings: manifest.warnings.length, hash: newHash }),
    raw_csv: text,
    ...(operator ? { reconciled_by: operator } : {}),
  };
  let result;
  try {
    result = await persist(meta, records);
  } catch (e) {
    return { code: EXIT.RUNTIME_ERROR, stdout: '', stderr: `error: import failed: ${e.message}` };
  }

  return {
    code: EXIT.SUCCESS,
    stdout: formatWriteSummary({
      partner,
      period,
      bounds,
      file,
      csvDoc,
      manifest,
      decision,
      outcome: 'imported',
      report_id: result.report_id,
      imported: result.lineCount,
      replacedCount,
    }),
    stderr: '',
  };
}
