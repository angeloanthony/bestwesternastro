// Reconciliation CLI orchestration (M8).
//
// runReconcile(argv, deps) → { code, stdout, stderr }. It never touches process/console; the
// shell (scripts/reconcile.mjs) supplies real dependencies and turns the result into
// stdout/stderr + an exit code. Everything is injected so this is unit-tested with no
// filesystem, database, or clock.
//
// Flow: parse args → fetch (lines, intents, commission rate) → reconcile() → summarize →
// unless --dry-run, applyReconciliation() → optionally age stale intents. Ambiguous and
// unmatched results are normal business states, NOT errors: they exit 0 and are reported.

import { parseArgs } from 'node:util';

import { reconcile } from './match.mjs';

/** Exit codes, matching the importer. */
export const EXIT = Object.freeze({
  SUCCESS: 0,
  RUNTIME_ERROR: 1,
  USAGE: 2,
});

export const USAGE = `partner report reconciliation matcher (M8)

Usage:
  npm run reconcile:run -- --partner <slug> [options]

Required:
  --partner <slug>     partner registry slug, e.g. best-western-vernal

Options:
  --period <YYYY-MM>   only reconcile lines whose arrival falls in this month
  --window-days <n>    arrival tolerance for promo+arrival matching (default 1)
  --age-days <n>       also age unmatched intents older than n days to 'no_match'
  --operator <name>    who ran the reconciliation (recorded in notes/logs)
  --dry-run            compute + report the plan; make NO database writes
  -h, --help           show this help`;

/** Expand a `YYYY-MM` month into inclusive ISO day bounds (mirrors the importer). */
export function expandPeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    period_start: `${year}-${mm}-01`,
    period_end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Parse + validate CLI args.
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
        'window-days': { type: 'string' },
        'age-days': { type: 'string' },
        operator: { type: 'string' },
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
  if (values.help) return { values, errors: [], help: true, periodBounds: null };

  const errors = [];
  if (!values.partner) errors.push('missing required --partner <slug>');

  let periodBounds = null;
  if (values.period) {
    periodBounds = expandPeriod(values.period);
    if (!periodBounds) errors.push(`invalid --period '${values.period}' (expected YYYY-MM)`);
  }
  if (values['window-days'] !== undefined && !isNonNegativeInt(values['window-days'])) {
    errors.push(
      `invalid --window-days '${values['window-days']}' (expected a non-negative integer)`
    );
  }
  if (values['age-days'] !== undefined && !isPositiveInt(values['age-days'])) {
    errors.push(`invalid --age-days '${values['age-days']}' (expected a positive integer)`);
  }

  return { values, errors, help: false, periodBounds };
}

function isNonNegativeInt(s) {
  return /^\d+$/.test(s);
}
function isPositiveInt(s) {
  return /^\d+$/.test(s) && Number(s) > 0;
}

const cents = (c) => `$${(c / 100).toFixed(2)}`;

/** Render the reconciliation summary. */
export function formatSummary(s) {
  const { partner, period, plan, result, dryRun, commissionPercent, aged } = s;
  const lines = [];
  lines.push(`Reconciliation ${dryRun ? '— DRY RUN (no writes)' : 'summary'}`);
  lines.push(`  partner : ${partner}`);
  if (period) lines.push(`  period  : ${period}`);
  lines.push(
    `  rate    : ${commissionPercent === null ? 'none on record — commission left NULL' : `${commissionPercent}%`}`
  );
  lines.push('  ----');
  // Counts reflect what was actually applied (result), not just what was planned; leftover
  // line/intent counts come from the plan (they are not part of the applied result).
  lines.push(
    `  lines in scope : ${result.applied.length + result.ambiguousFlagged + plan.unmatchedLines.length}`
  );
  lines.push(`  matched        : ${result.applied.length}`);
  for (const t of tierBreakdown(result.applied)) lines.push(`      ${t}`);
  lines.push(`  ambiguous      : ${result.ambiguousFlagged} (left for manual review)`);
  lines.push(`  unmatched lines: ${plan.unmatchedLines.length}`);
  lines.push(`  open intents   : ${plan.unmatchedIntents.length} (no line claimed them)`);
  lines.push('  ----');
  lines.push(`  stays confirmed: ${result.stayed}`);
  lines.push(`  cancel/refund  : ${result.cancelled}`);
  lines.push(`  room nights    : ${result.roomNights}`);
  lines.push(`  revenue        : ${cents(result.revenueCents)}`);
  if (result.commissionNullCount > 0) {
    lines.push(
      `  commission     : ${cents(result.commissionCents)} on ${result.stayed - result.commissionNullCount} stay(s); ` +
        `${result.commissionNullCount} stay(s) left NULL (no rate on record)`
    );
  } else {
    lines.push(`  commission     : ${cents(result.commissionCents)}`);
  }
  if (aged !== null && aged !== undefined) {
    lines.push(`  aged → no_match: ${aged}`);
  }
  lines.push('  ----');
  lines.push(
    dryRun
      ? '  RESULT: DRY RUN — plan computed, no writes performed.'
      : `  RESULT: OK — ${result.applied.length} match(es) applied, ${result.ambiguousFlagged} flagged ambiguous.`
  );
  return lines.join('\n');
}

function tierBreakdown(matches) {
  const counts = new Map();
  for (const m of matches) {
    const key = `${m.tier} (${m.confidence})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([k, n]) => `${n} via ${k}`);
}

/**
 * Run the reconciliation.
 *
 * @param {string[]} argv
 * @param {Object} deps
 * @param {(args:Object)=>Promise<Object[]>} deps.fetchLines
 * @param {(args:Object)=>Promise<Object[]>} deps.fetchIntents
 * @param {(slug:string)=>Promise<number|null>} deps.fetchCommission
 * @param {(plan:Object, opts:Object)=>Promise<Object>} deps.apply
 * @param {(args:Object)=>Promise<number>} [deps.age]
 * @param {()=>string} deps.now            Returns an ISO timestamp (injected clock).
 * @param {(days:number)=>string} [deps.cutoffFor] days → ISO cutoff for aging.
 * @param {Object<string,string>} [deps.lastNameByIntentId] Optional member last names.
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
export async function runReconcile(argv, deps) {
  const { fetchLines, fetchIntents, fetchCommission, apply, age, now, cutoffFor } = deps;
  const { values, errors, help, periodBounds } = parseCliArgs(argv);

  if (help) return { code: EXIT.SUCCESS, stdout: USAGE, stderr: '' };
  if (errors.length > 0) {
    return {
      code: EXIT.USAGE,
      stdout: '',
      stderr: `${USAGE}\n\n${errors.map((e) => `error: ${e}`).join('\n')}`,
    };
  }

  const partner = values.partner;
  const period = values.period ?? null;
  const dryRun = Boolean(values['dry-run']);
  const windowDays =
    values['window-days'] !== undefined ? Number(values['window-days']) : undefined;
  const ageDays = values['age-days'] !== undefined ? Number(values['age-days']) : null;

  try {
    const [lines, intents, commissionPercent] = await Promise.all([
      fetchLines({
        partner_slug: partner,
        period_start: periodBounds?.period_start,
        period_end: periodBounds?.period_end,
      }),
      fetchIntents({ partner_slug: partner }),
      fetchCommission(partner),
    ]);

    const plan = reconcile(lines, intents, {
      windowDays,
      lastNameByIntentId: deps.lastNameByIntentId,
    });

    const result = await apply(plan, { commissionPercent, now: now(), dryRun });

    let aged = null;
    if (ageDays !== null) {
      if (!age || !cutoffFor) throw new Error('aging requested but no age handler was provided');
      aged = await age({ partner_slug: partner, cutoffIso: cutoffFor(ageDays), dryRun });
    }

    return {
      code: EXIT.SUCCESS,
      stdout: formatSummary({ partner, period, plan, result, dryRun, commissionPercent, aged }),
      stderr: '',
    };
  } catch (e) {
    return {
      code: EXIT.RUNTIME_ERROR,
      stdout: '',
      stderr: `error: reconciliation failed: ${e.message}`,
    };
  }
}
