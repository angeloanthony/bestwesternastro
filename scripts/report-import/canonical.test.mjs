// Tests for the canonical line-record contract (M6 · T03).
// Run: node --test scripts/report-import/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CANONICAL_FIELDS, createCanonicalRecord } from './canonical.mjs';

// The documented canonical schema (docs/M6_CSV_IMPORTER.md §3), duplicated here on purpose
// so the test is an INDEPENDENT check: if someone edits the module's field list, this
// literal must be updated too — that friction is the guardrail against silent drift.
const DOCUMENTED_SCHEMA = [
  'external_ref',
  'customer_name',
  'promo_code',
  'service_start',
  'service_end',
  'quantity',
  'unit_label',
  'revenue_cents',
  'currency',
  'raw',
];

test('exported contract matches the documented canonical schema exactly', () => {
  // Same names, same order, same count — no additions, removals, or reordering.
  assert.deepEqual([...CANONICAL_FIELDS], DOCUMENTED_SCHEMA);
});

test('field names remain stable (no drift in the contract list)', () => {
  // Names are load-bearing: they mirror partner_report_line columns. Assert each expected
  // name is present and no unexpected name has crept in.
  const expected = new Set(DOCUMENTED_SCHEMA);
  const actual = new Set(CANONICAL_FIELDS);
  assert.equal(actual.size, expected.size, 'unexpected number of canonical fields');
  for (const name of expected) {
    assert.ok(actual.has(name), `missing canonical field: ${name}`);
  }
});

test('the field list is frozen (contract cannot be mutated at runtime)', () => {
  assert.ok(Object.isFrozen(CANONICAL_FIELDS));
});

test('createCanonicalRecord returns all required fields', () => {
  const record = createCanonicalRecord();
  assert.deepEqual(Object.keys(record), DOCUMENTED_SCHEMA);
  // Every field present and defaulted to null when not supplied.
  for (const field of DOCUMENTED_SCHEMA) {
    assert.ok(field in record, `record is missing field: ${field}`);
    assert.equal(record[field], null);
  }
});

test('createCanonicalRecord seeds known values and ignores unknown keys', () => {
  const raw = { 'Confirmation #': 'ABC123', Guest: 'Doe, Jane' };
  const record = createCanonicalRecord({
    external_ref: 'ABC123',
    quantity: 2,
    unit_label: 'room_nights',
    revenue_cents: 19900,
    currency: 'USD',
    raw,
    not_a_field: 'should be dropped',
  });

  assert.equal(record.external_ref, 'ABC123');
  assert.equal(record.quantity, 2);
  assert.equal(record.unit_label, 'room_nights');
  assert.equal(record.revenue_cents, 19900);
  assert.equal(record.currency, 'USD');
  assert.deepEqual(record.raw, raw);
  // Unsupplied canonical field stays null; non-canonical key is not copied in.
  assert.equal(record.promo_code, null);
  assert.ok(!('not_a_field' in record));
  // Shape is still exactly the canonical key set.
  assert.deepEqual(Object.keys(record), DOCUMENTED_SCHEMA);
});
