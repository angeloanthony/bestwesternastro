// Tests for canonical-record validation (M6 · T07).
// Run: node --test scripts/report-import/validate.test.mjs
//
// Inputs are built with the canonical factory (createCanonicalRecord) on purpose: it
// proves validation operates on CANONICAL records, never on CSV headers or partner input.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCanonicalRecord } from './canonical.mjs';
import { validateRecords, REQUIRED_FIELDS, SOFT_FIELDS } from './validate.mjs';

// A fully valid canonical record; tests override single fields to isolate one rule.
function goodRecord(overrides = {}) {
  return createCanonicalRecord({
    external_ref: 'R1',
    customer_name: 'Doe, Jane',
    promo_code: 'ADVENTURE',
    service_start: '2026-06-01',
    service_end: '2026-06-03',
    quantity: 2,
    unit_label: 'room_nights',
    revenue_cents: 19950,
    currency: 'USD',
    raw: { any: 'thing' },
    ...overrides,
  });
}

const codes = (issues) => issues.map((i) => i.code);
const forField = (issues, field) => issues.filter((i) => i.field === field);

test('a fully valid record passes clean (ok, no errors, no warnings)', () => {
  const m = validateRecords([goodRecord()]);
  assert.equal(m.ok, true);
  assert.deepEqual(m.errors, []);
  assert.deepEqual(m.warnings, []);
});

test('each required field, when missing, produces a fatal missing_required', () => {
  for (const field of REQUIRED_FIELDS) {
    const m = validateRecords([goodRecord({ [field]: null })]);
    assert.equal(m.ok, false, `${field} missing should be fatal`);
    const hit = forField(m.errors, field);
    assert.equal(hit.length, 1, `expected one error for ${field}`);
    assert.equal(hit[0].code, 'missing_required');
  }
});

test('blank / whitespace-only strings count as missing for required fields', () => {
  const m = validateRecords([goodRecord({ external_ref: '   ', currency: '' })]);
  assert.equal(m.ok, false);
  assert.ok(forField(m.errors, 'external_ref').some((i) => i.code === 'missing_required'));
  assert.ok(forField(m.errors, 'currency').some((i) => i.code === 'missing_required'));
});

test('each soft field, when missing, produces a warning (not fatal)', () => {
  for (const field of SOFT_FIELDS) {
    const m = validateRecords([goodRecord({ [field]: null })]);
    assert.equal(m.ok, true, `${field} missing should NOT be fatal`);
    const hit = forField(m.warnings, field);
    assert.equal(hit.length, 1);
    assert.equal(hit[0].code, 'missing_optional');
  }
});

test('invalid dates are fatal (bad format and impossible calendar date)', () => {
  const badFormat = validateRecords([goodRecord({ service_start: '06/01/2026' })]);
  assert.equal(badFormat.ok, false);
  assert.equal(forField(badFormat.errors, 'service_start')[0].code, 'invalid_date');

  const impossible = validateRecords([goodRecord({ service_end: '2026-02-30' })]);
  assert.equal(impossible.ok, false);
  assert.equal(forField(impossible.errors, 'service_end')[0].code, 'invalid_date');
});

test('service_end before service_start is fatal (end_before_start)', () => {
  const m = validateRecords([
    goodRecord({ service_start: '2026-06-05', service_end: '2026-06-01' }),
  ]);
  assert.equal(m.ok, false);
  assert.equal(forField(m.errors, 'service_end')[0].code, 'end_before_start');
});

test('equal service_start and service_end is allowed (only strictly-before is flagged)', () => {
  const m = validateRecords([
    goodRecord({ service_start: '2026-06-01', service_end: '2026-06-01' }),
  ]);
  assert.equal(m.ok, true);
});

test('invalid quantities are fatal (non-integer, zero, negative, NaN)', () => {
  for (const bad of [0, -1, 2.5, Number.NaN, 'two']) {
    const m = validateRecords([goodRecord({ quantity: bad })]);
    assert.equal(m.ok, false, `quantity=${String(bad)} should be fatal`);
    assert.equal(forField(m.errors, 'quantity')[0].code, 'invalid_quantity');
  }
});

test('invalid revenue is fatal (non-integer / NaN)', () => {
  for (const bad of [199.5, Number.NaN, '199']) {
    const m = validateRecords([goodRecord({ revenue_cents: bad })]);
    assert.equal(m.ok, false, `revenue=${String(bad)} should be fatal`);
    assert.equal(forField(m.errors, 'revenue_cents')[0].code, 'invalid_revenue');
  }
});

test('negative revenue is a WARNING, not a fatal error', () => {
  const m = validateRecords([goodRecord({ revenue_cents: -500 })]);
  assert.equal(m.ok, true);
  assert.equal(forField(m.warnings, 'revenue_cents')[0].code, 'negative_revenue');
  assert.equal(m.errors.length, 0);
});

test('duplicate external_ref within the batch is fatal on the later occurrence', () => {
  const m = validateRecords([
    goodRecord({ external_ref: 'DUP' }),
    goodRecord({ external_ref: 'UNIQUE' }),
    goodRecord({ external_ref: 'DUP' }),
  ]);
  assert.equal(m.ok, false);
  const dups = m.errors.filter((i) => i.code === 'duplicate_external_ref');
  assert.equal(dups.length, 1);
  assert.equal(dups[0].row, 2); // flagged on the second occurrence
});

test('collects ALL violations across a bad batch (never stops at first)', () => {
  const m = validateRecords([
    goodRecord({ external_ref: null, quantity: -1 }), // 2 errors on row 0
    goodRecord({ external_ref: 'R2', service_start: 'bad', promo_code: null }), // 1 err + 1 warn, row 1
    goodRecord({ external_ref: 'R3', revenue_cents: 12.3 }), // 1 error on row 2
  ]);
  assert.equal(m.ok, false);
  // Row 0: missing_required(external_ref) + invalid_quantity
  assert.deepEqual(codes(m.errors.filter((i) => i.row === 0)).sort(), [
    'invalid_quantity',
    'missing_required',
  ]);
  // Row 1: invalid_date error + missing_optional warning
  assert.deepEqual(codes(m.errors.filter((i) => i.row === 1)), ['invalid_date']);
  assert.deepEqual(codes(m.warnings.filter((i) => i.row === 1)), ['missing_optional']);
  // Row 2: invalid_revenue
  assert.deepEqual(codes(m.errors.filter((i) => i.row === 2)), ['invalid_revenue']);
  // Everything is accounted for and row-ordered.
  assert.deepEqual(
    m.errors.map((i) => i.row),
    [0, 0, 1, 2]
  );
});

test('warnings-only batch still reports ok=true', () => {
  const m = validateRecords([goodRecord({ promo_code: null, revenue_cents: -100 })]);
  assert.equal(m.ok, true);
  assert.deepEqual(codes(m.warnings).sort(), ['missing_optional', 'negative_revenue']);
});

test('empty batch is valid (ok, no issues)', () => {
  const m = validateRecords([]);
  assert.deepEqual(m, { ok: true, errors: [], warnings: [] });
});

test('non-array input throws TypeError', () => {
  assert.throws(() => validateRecords(null), TypeError);
  assert.throws(() => validateRecords({ external_ref: 'x' }), TypeError);
});

test('records are not mutated by validation', () => {
  const rec = goodRecord({ revenue_cents: -5 });
  const snapshot = structuredClone(rec);
  validateRecords([rec]);
  assert.deepEqual(rec, snapshot);
});
