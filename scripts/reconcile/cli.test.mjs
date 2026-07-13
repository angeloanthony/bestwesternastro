// Tests for the reconciliation CLI orchestration (M8).
// Run: node --test scripts/reconcile/cli.test.mjs
//
// The orchestration is exercised with injected deps (no DB, no filesystem, no clock), so we
// assert argument handling, the dry-run vs write path, the aging hook, and that ambiguous /
// unmatched results are reported as success (not errors).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runReconcile, parseCliArgs, expandPeriod, EXIT, USAGE } from './cli.mjs';

test('expandPeriod: YYYY-MM → inclusive bounds; junk → null', () => {
  assert.deepEqual(expandPeriod('2026-06'), { period_start: '2026-06-01', period_end: '2026-06-30' });
  assert.deepEqual(expandPeriod('2026-02'), { period_start: '2026-02-01', period_end: '2026-02-28' });
  assert.equal(expandPeriod('2026-13'), null);
  assert.equal(expandPeriod('nope'), null);
});

test('parseCliArgs: requires --partner', () => {
  const { errors } = parseCliArgs([]);
  assert.ok(errors.some((e) => /--partner/.test(e)));
});

test('parseCliArgs: validates --period, --window-days, --age-days', () => {
  assert.ok(parseCliArgs(['--partner', 'bw', '--period', 'xx']).errors.some((e) => /--period/.test(e)));
  assert.ok(parseCliArgs(['--partner', 'bw', '--window-days', 'x']).errors.some((e) => /--window-days/.test(e)));
  assert.ok(parseCliArgs(['--partner', 'bw', '--age-days', '0']).errors.some((e) => /--age-days/.test(e)));
  assert.equal(parseCliArgs(['--partner', 'bw', '--window-days', '2', '--age-days', '45']).errors.length, 0);
});

// A deps factory that records calls and returns canned data.
function deps(over = {}) {
  const calls = { apply: [], age: [], fetchLines: [] };
  return {
    calls,
    fetchLines: async (args) => {
      calls.fetchLines.push(args);
      return over.lines ?? [];
    },
    fetchIntents: async () => over.intents ?? [],
    fetchCommission: async () => (over.commission === undefined ? 10 : over.commission),
    apply: async (plan, opts) => {
      calls.apply.push({ plan, opts });
      return (
        over.result ?? {
          applied: plan.matches.map((m) => ({ intent_id: m.intent.id })),
          ambiguousFlagged: plan.ambiguous.length,
          stayed: plan.matches.length,
          cancelled: 0,
          roomNights: 2 * plan.matches.length,
          revenueCents: 19950 * plan.matches.length,
          commissionCents: 1995 * plan.matches.length,
          commissionNullCount: 0,
        }
      );
    },
    age: async (args) => {
      calls.age.push(args);
      return over.aged ?? 3;
    },
    now: () => '2026-07-13T00:00:00.000Z',
    cutoffFor: (days) => `cutoff-${days}`,
    ...over.deps,
  };
}

const L = { id: 'L1', external_ref: 'CONF1', promo_code: 'ADVENTURE', service_start: '2026-06-10', quantity: 2, revenue_cents: 19950, raw: {} };
const I = { id: 'I1', ref_code: 'X', promo_code: 'ADVENTURE', checkin: '2026-06-10', status: 'clicked', created_at: '2026-06-10T00:00:00Z' };

test('help + usage', async () => {
  const help = await runReconcile(['--help'], deps());
  assert.equal(help.code, EXIT.SUCCESS);
  assert.equal(help.stdout, USAGE);

  const bad = await runReconcile([], deps());
  assert.equal(bad.code, EXIT.USAGE);
  assert.match(bad.stderr, /--partner/);
});

test('happy path: fetches, matches, applies, reports OK', async () => {
  const d = deps({ lines: [L], intents: [I] });
  const r = await runReconcile(['--partner', 'best-western-vernal'], d);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.equal(d.calls.apply.length, 1);
  assert.equal(d.calls.apply[0].opts.dryRun, false);
  assert.equal(d.calls.apply[0].opts.commissionPercent, 10);
  assert.match(r.stdout, /matched\s+: 1/);
  assert.match(r.stdout, /RESULT: OK/);
});

test('dry-run: passes dryRun through and labels the report', async () => {
  const d = deps({ lines: [L], intents: [I] });
  const r = await runReconcile(['--partner', 'bw', '--dry-run'], d);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.equal(d.calls.apply[0].opts.dryRun, true);
  assert.match(r.stdout, /DRY RUN/);
});

test('period is expanded and forwarded to the line fetch', async () => {
  const d = deps({ lines: [L], intents: [I] });
  await runReconcile(['--partner', 'bw', '--period', '2026-06'], d);
  assert.equal(d.calls.fetchLines[0].period_start, '2026-06-01');
  assert.equal(d.calls.fetchLines[0].period_end, '2026-06-30');
});

test('null commission rate is reported, not fatal', async () => {
  const d = deps({
    lines: [L],
    intents: [I],
    commission: null,
    result: {
      applied: [{ intent_id: 'I1' }],
      ambiguousFlagged: 0,
      stayed: 1,
      cancelled: 0,
      roomNights: 2,
      revenueCents: 19950,
      commissionCents: 0,
      commissionNullCount: 1,
    },
  });
  const r = await runReconcile(['--partner', 'bw'], d);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.match(r.stdout, /none on record — commission left NULL/);
  assert.match(r.stdout, /left NULL \(no rate on record\)/);
});

test('--age-days invokes the aging hook with the computed cutoff', async () => {
  const d = deps({ lines: [], intents: [] });
  const r = await runReconcile(['--partner', 'bw', '--age-days', '45'], d);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.equal(d.calls.age.length, 1);
  assert.equal(d.calls.age[0].cutoffIso, 'cutoff-45');
  assert.match(r.stdout, /aged → no_match: 3/);
});

test('ambiguous + unmatched results still exit 0 (normal business states)', async () => {
  const d = deps({
    lines: [L],
    intents: [I],
    result: {
      applied: [],
      ambiguousFlagged: 1,
      stayed: 0,
      cancelled: 0,
      roomNights: 0,
      revenueCents: 0,
      commissionCents: 0,
      commissionNullCount: 0,
    },
  });
  const r = await runReconcile(['--partner', 'bw'], d);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.match(r.stdout, /ambiguous\s+: 1/);
});

test('a fetch failure is surfaced as a runtime error (exit 1)', async () => {
  const d = deps();
  d.fetchIntents = async () => {
    throw new Error('db unreachable');
  };
  const r = await runReconcile(['--partner', 'bw'], d);
  assert.equal(r.code, EXIT.RUNTIME_ERROR);
  assert.match(r.stderr, /reconciliation failed: db unreachable/);
});
