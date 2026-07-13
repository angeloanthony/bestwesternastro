// Tests for CLI orchestration — read path (M6 · Phase D).
// Run: node --test scripts/report-import/cli.test.mjs
//
// A TEMPORARY MOCK profile is injected via resolveProfile; the real Best Western profile
// is T04 and is NOT built here. Dependencies (readFile, resolveProfile) are injected so no
// filesystem or database is touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runImport, parseCliArgs, expandPeriod, EXIT } from './cli.mjs';

// Minimal mock profile (same shape the T06 transform consumes) — generic, not partner-real.
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
  unitLabel: 'widgets',
};

const HEADER = 'Ref,Name,Promo,Start,End,Qty,Amount,Curr';
const goodCsv = `${HEADER}\nR1,Doe,SAVE,2026-06-01,2026-06-03,2,199.50,USD`;
const fatalCsv = `${HEADER}\n,Doe,SAVE,2026-06-01,2026-06-03,2,199.50,USD`; // blank Ref → missing_required
const warnCsv = `${HEADER}\nR1,Doe,,2026-06-01,2026-06-03,2,-5.00,USD`; // no promo + negative revenue

const okArgs = ['--partner', 'best-western-vernal', '--period', '2026-06', '--file', 'in.csv'];
const deps = (text, profile = mockProfile) => ({
  readFile: () => text,
  resolveProfile: () => profile,
});

// ── expandPeriod ─────────────────────────────────────────────────────────────
test('expandPeriod: expands a month to inclusive ISO bounds', () => {
  assert.deepEqual(expandPeriod('2026-06'), {
    period_start: '2026-06-01',
    period_end: '2026-06-30',
  });
});

test('expandPeriod: handles February and leap years', () => {
  assert.equal(expandPeriod('2026-02').period_end, '2026-02-28');
  assert.equal(expandPeriod('2024-02').period_end, '2024-02-29'); // leap year
  assert.equal(expandPeriod('2026-12').period_end, '2026-12-31');
});

test('expandPeriod: rejects bad month formats', () => {
  for (const bad of ['2026-13', '2026-00', '2026/06', 'June', '2026-6', '']) {
    assert.equal(expandPeriod(bad), null, `should reject ${bad}`);
  }
});

// ── parseCliArgs ─────────────────────────────────────────────────────────────
test('parseCliArgs: valid args parse with expanded period and no errors', () => {
  const r = parseCliArgs([...okArgs, '--operator', 'rocco']);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.partner, 'best-western-vernal');
  assert.equal(r.values.file, 'in.csv');
  assert.equal(r.values.operator, 'rocco');
  assert.deepEqual(r.periodBounds, { period_start: '2026-06-01', period_end: '2026-06-30' });
});

test('parseCliArgs: reports each missing required argument', () => {
  assert.ok(parseCliArgs([]).errors.some((e) => e.includes('--partner')));
  assert.ok(parseCliArgs([]).errors.some((e) => e.includes('--period')));
  assert.ok(parseCliArgs([]).errors.some((e) => e.includes('--file')));
});

test('parseCliArgs: reports an invalid period format', () => {
  const r = parseCliArgs(['--partner', 'p', '--period', '2026-13', '--file', 'f']);
  assert.ok(r.errors.some((e) => e.includes("invalid --period '2026-13'")));
});

test('parseCliArgs: unknown flags surface as an error (strict)', () => {
  const r = parseCliArgs([...okArgs, '--bogus', 'x']);
  assert.ok(r.errors.length > 0);
});

test('parseCliArgs: --help is recognised', () => {
  assert.equal(parseCliArgs(['--help']).help, true);
  assert.equal(parseCliArgs(['-h']).help, true);
});

// ── runImport: happy path & exit codes ───────────────────────────────────────
test('runImport: clean CSV exits 0 with an OK summary', () => {
  const r = runImport(okArgs, deps(goodCsv));
  assert.equal(r.code, EXIT.SUCCESS);
  assert.match(r.stdout, /RESULT: OK/);
  assert.match(r.stdout, /1 data row\(s\), 8 column\(s\)/);
  assert.match(r.stdout, /No writes performed/);
  assert.equal(r.stderr, '');
});

test('runImport: fatal validation exits non-zero and lists the error', () => {
  const r = runImport(okArgs, deps(fatalCsv));
  assert.equal(r.code, EXIT.VALIDATION_FAILED);
  assert.notEqual(r.code, 0);
  assert.match(r.stdout, /RESULT: FAIL/);
  assert.match(r.stdout, /missing_required/);
});

test('runImport: warnings-only CSV still exits 0 and shows warnings', () => {
  const r = runImport(okArgs, deps(warnCsv));
  assert.equal(r.code, EXIT.SUCCESS);
  assert.match(r.stdout, /RESULT: OK/);
  assert.match(r.stdout, /warnings: 2/);
  assert.match(r.stdout, /negative_revenue/);
  assert.match(r.stdout, /missing_optional/);
});

test('runImport: summary echoes partner, expanded period, and file', () => {
  const r = runImport(okArgs, deps(goodCsv));
  assert.match(r.stdout, /partner : best-western-vernal/);
  assert.match(r.stdout, /period {2}: 2026-06 \(2026-06-01 → 2026-06-30\)/);
  assert.match(r.stdout, /file {4}: in\.csv/);
});

// ── runImport: failure paths ─────────────────────────────────────────────────
test('runImport: missing required args exit with USAGE code and print usage', () => {
  const r = runImport([], deps(goodCsv));
  assert.equal(r.code, EXIT.USAGE);
  assert.match(r.stderr, /Usage:/);
  assert.match(r.stderr, /missing required --partner/);
  assert.equal(r.stdout, '');
});

test('runImport: --help exits 0 with usage on stdout', () => {
  const r = runImport(['--help'], deps(goodCsv));
  assert.equal(r.code, EXIT.SUCCESS);
  assert.match(r.stdout, /Usage:/);
});

test('runImport: unknown partner (no profile) exits non-zero', () => {
  const r = runImport(okArgs, { readFile: () => goodCsv, resolveProfile: () => null });
  assert.equal(r.code, EXIT.RUNTIME_ERROR);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /no profile registered for partner 'best-western-vernal'/);
});

test('runImport: unreadable file exits non-zero with the fs error message', () => {
  const r = runImport(okArgs, {
    resolveProfile: () => mockProfile,
    readFile: () => {
      throw new Error('ENOENT: no such file or directory');
    },
  });
  assert.equal(r.code, EXIT.RUNTIME_ERROR);
  assert.match(r.stderr, /cannot read file 'in\.csv'/);
  assert.match(r.stderr, /ENOENT/);
});

test('runImport: empty file validates as 0 rows and exits 0 with a note', () => {
  const r = runImport(okArgs, deps(''));
  assert.equal(r.code, EXIT.SUCCESS);
  assert.match(r.stdout, /no data rows found/);
});

// ── No persistence surface ───────────────────────────────────────────────────
test('runImport: only reads — file is read exactly once, nothing is written', () => {
  let reads = 0;
  const r = runImport(okArgs, {
    readFile: () => {
      reads += 1;
      return goodCsv;
    },
    resolveProfile: () => mockProfile,
  });
  assert.equal(reads, 1);
  assert.equal(r.code, EXIT.SUCCESS);
  // The dependency surface is read-only: there is no writeFile / db client to inject.
});
