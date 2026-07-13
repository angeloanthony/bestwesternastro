// Tests for CLI write-path integration (M6 · Phase F, T15).
// Run: node --test scripts/report-import/cli.write.test.mjs
//
// Uses the temporary MOCK profile and injected high-level deps (fetchReports/persist/
// remove) — no filesystem, no database, no real Best Western profile. The persistence
// primitives these deps wrap are tested in persist.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runWriteImport, buildSourceNote, EXIT } from './cli.mjs';
import { sha256Hex, parseHashToken } from './dedup.mjs';

const mockProfile = {
  map: {
    external_ref: 'Ref',
    customer_name: 'Name',
    promo_code: 'Promo',
    service_start: 'Start',
    service_end: 'End',
    quantity: 'Qty',
    revenue_cents: 'Amount',
    currency: 'Curr',
  },
  coerce: {
    quantity: (v) => Number.parseInt(v, 10),
    revenue_cents: (v) => Math.round(Number.parseFloat(v) * 100),
  },
  unitLabel: 'room_nights',
};

const HEADER = 'Ref,Name,Promo,Start,End,Qty,Amount,Curr';
const goodCsv = `${HEADER}\nR1,Doe,ADVENTURE,2026-06-01,2026-06-03,2,199.50,USD`;
const twoRowCsv = `${goodCsv}\nR2,Roe,ADVENTURE,2026-06-04,2026-06-06,2,150.00,USD`;
const warnCsv = `${HEADER}\nR1,Doe,,2026-06-01,2026-06-03,2,199.50,USD`; // no promo → 1 warning
const fatalCsv = `${HEADER}\n,Doe,ADVENTURE,2026-06-01,2026-06-03,2,199.50,USD`; // blank Ref → fatal

const ARGS = ['--partner', 'best-western-vernal', '--period', '2026-06', '--file', 'in.csv'];

// Build injected deps + a call recorder.
function makeDeps({ csv = goodCsv, existing = [], persistFails, removeFails, fetchFails } = {}) {
  const calls = { fetch: [], persist: [], remove: [] };
  const deps = {
    readFile: () => csv,
    resolveProfile: () => mockProfile,
    fetchReports: async (slug) => {
      calls.fetch.push(slug);
      if (fetchFails) throw new Error('db unreachable');
      return existing;
    },
    persist: async (meta, records) => {
      calls.persist.push({ meta, records });
      if (persistFails) throw new Error('insert boom');
      return { report_id: 'rep-xyz', lineCount: records.length };
    },
    remove: async (id) => {
      calls.remove.push(id);
      if (removeFails) throw new Error('delete boom');
    },
  };
  return { deps, calls };
}

// ── happy path (allow) ───────────────────────────────────────────────────────
test('allow: no existing reports → persists and exits 0', async () => {
  const { deps, calls } = makeDeps({ csv: twoRowCsv });
  const r = await runWriteImport(ARGS, deps);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.equal(calls.fetch.length, 1);
  assert.equal(calls.persist.length, 1);
  assert.equal(calls.remove.length, 0); // no replace
  assert.match(r.stdout, /RESULT: OK/);
  assert.match(r.stdout, /dedup {3}: allow/);
  assert.match(r.stdout, /report_id : rep-xyz/);
  assert.match(r.stdout, /imported {2}: 2 line\(s\)/);
  assert.match(r.stdout, /parsed {2}: 2 data row\(s\)/);
});

test('allow: persist metadata carries raw_csv + a source_note hash token, no commission', async () => {
  const { deps, calls } = makeDeps({ csv: warnCsv }); // 1 warning
  await runWriteImport([...ARGS, '--operator', 'rocco'], deps);
  const { meta, records } = calls.persist[0];
  assert.equal(meta.partner_slug, 'best-western-vernal');
  assert.equal(meta.period_start, '2026-06-01');
  assert.equal(meta.period_end, '2026-06-30');
  assert.equal(meta.raw_csv, warnCsv); // verbatim
  assert.equal(meta.reconciled_by, 'rocco');
  assert.equal(parseHashToken(meta.source_note), sha256Hex(warnCsv)); // token round-trips
  assert.match(meta.source_note, /1 warning\(s\)/);
  // No matching / commission fields leak into the metadata or the records.
  assert.ok(!('commission_cents' in meta));
  assert.ok(!('booking_intent_id' in meta));
  assert.ok(records.every((rec) => !('commission_cents' in rec)));
});

test('summary reports the warning count', async () => {
  const { deps } = makeDeps({ csv: warnCsv });
  const r = await runWriteImport(ARGS, deps);
  assert.match(r.stdout, /warnings {2}: 1/);
  assert.match(r.stdout, /errors {4}: 0 fatal/);
});

// ── fatal validation → no dedup, no writes ───────────────────────────────────
test('fatal validation: aborts before dedup and persist, exits non-zero', async () => {
  const { deps, calls } = makeDeps({ csv: fatalCsv });
  const r = await runWriteImport(ARGS, deps);
  assert.equal(r.code, EXIT.VALIDATION_FAILED);
  assert.equal(calls.fetch.length, 0); // dedup never ran
  assert.equal(calls.persist.length, 0); // nothing written
  assert.match(r.stdout, /RESULT: FAIL/);
  assert.match(r.stdout, /missing_required/);
});

// ── block-duplicate ──────────────────────────────────────────────────────────
test('block-duplicate: identical file already imported → blocked, no persist', async () => {
  // Existing report whose stored bytes hash to the same value (same csv text).
  const existing = [
    {
      id: 'old-1',
      partner_slug: 'best-western-vernal',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: goodCsv,
    },
  ];
  const { deps, calls } = makeDeps({ csv: goodCsv, existing });
  const r = await runWriteImport(ARGS, deps);
  assert.equal(r.code, EXIT.VALIDATION_FAILED);
  assert.equal(calls.persist.length, 0);
  assert.equal(calls.remove.length, 0);
  assert.match(r.stdout, /dedup {3}: block-duplicate/);
  assert.match(r.stdout, /RESULT: BLOCKED/);
});

// ── warn-overlap ─────────────────────────────────────────────────────────────
test('warn-overlap: same period, different content, no --replace → blocked', async () => {
  const existing = [
    {
      id: 'old-1',
      partner_slug: 'best-western-vernal',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: 'DIFFERENT',
    },
  ];
  const { deps, calls } = makeDeps({ csv: goodCsv, existing });
  const r = await runWriteImport(ARGS, deps);
  assert.equal(r.code, EXIT.VALIDATION_FAILED);
  assert.equal(calls.persist.length, 0);
  assert.match(r.stdout, /dedup {3}: warn-overlap/);
  assert.match(r.stdout, /Re-run with --replace/);
});

// ── --replace ────────────────────────────────────────────────────────────────
test('--replace: voids the conflicting prior report, then persists', async () => {
  const existing = [
    {
      id: 'old-1',
      partner_slug: 'best-western-vernal',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: 'DIFFERENT',
    },
  ];
  const { deps, calls } = makeDeps({ csv: goodCsv, existing });
  const r = await runWriteImport([...ARGS, '--replace'], deps);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.deepEqual(calls.remove, ['old-1']); // prior report voided
  assert.equal(calls.persist.length, 1); // then imported
  assert.match(r.stdout, /replace : voided 1 prior report/);
  assert.match(r.stdout, /RESULT: OK.*replaced prior report/);
});

test('--replace with no conflict: nothing to void, still imports', async () => {
  const { deps, calls } = makeDeps({ csv: goodCsv, existing: [] });
  const r = await runWriteImport([...ARGS, '--replace'], deps);
  assert.equal(r.code, EXIT.SUCCESS);
  assert.equal(calls.remove.length, 0);
  assert.equal(calls.persist.length, 1);
});

// ── failure paths ────────────────────────────────────────────────────────────
test('fetchReports failure → non-zero, no persist', async () => {
  const { deps, calls } = makeDeps({ fetchFails: true });
  const r = await runWriteImport(ARGS, deps);
  assert.equal(r.code, EXIT.RUNTIME_ERROR);
  assert.equal(calls.persist.length, 0);
  assert.match(r.stderr, /cannot read existing reports/);
});

test('persist failure → non-zero', async () => {
  const { deps } = makeDeps({ persistFails: true });
  const r = await runWriteImport(ARGS, deps);
  assert.equal(r.code, EXIT.RUNTIME_ERROR);
  assert.match(r.stderr, /import failed.*insert boom/);
});

test('--replace remove failure → non-zero, no persist', async () => {
  const existing = [
    {
      id: 'old-1',
      partner_slug: 'best-western-vernal',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: 'DIFFERENT',
    },
  ];
  const { deps, calls } = makeDeps({ csv: goodCsv, existing, removeFails: true });
  const r = await runWriteImport([...ARGS, '--replace'], deps);
  assert.equal(r.code, EXIT.RUNTIME_ERROR);
  assert.equal(calls.persist.length, 0); // aborted before persist
  assert.match(r.stderr, /--replace failed to void/);
});

test('missing args → usage exit 2, no writes', async () => {
  const { deps, calls } = makeDeps();
  const r = await runWriteImport([], deps);
  assert.equal(r.code, EXIT.USAGE);
  assert.equal(calls.persist.length, 0);
  assert.match(r.stderr, /Usage:/);
});

test('unknown profile → non-zero, no dedup, no writes', async () => {
  const { deps, calls } = makeDeps();
  const r = await runWriteImport(ARGS, { ...deps, resolveProfile: () => null });
  assert.equal(r.code, EXIT.RUNTIME_ERROR);
  assert.equal(calls.fetch.length, 0);
  assert.equal(calls.persist.length, 0);
});

// ── buildSourceNote (pure) ───────────────────────────────────────────────────
test('buildSourceNote: includes operator, warning count, and hash token', () => {
  const hash = sha256Hex('x');
  const note = buildSourceNote({ operator: 'rocco', warnings: 2, hash });
  assert.match(note, /imported by rocco/);
  assert.match(note, /2 warning\(s\)/);
  assert.equal(parseHashToken(note), hash);
});

test('buildSourceNote: anonymous when no operator', () => {
  const note = buildSourceNote({ operator: null, warnings: 0, hash: sha256Hex('x') });
  assert.match(note, /^imported;/);
});
