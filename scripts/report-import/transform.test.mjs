// Tests for the profile-driven canonical transform (M6 · T06).
// Run: node --test scripts/report-import/transform.test.mjs
//
// A MINIMAL MOCK profile only — the real Best Western profile is T04 and is NOT built
// here. The mock deliberately uses nonsense headers/units to prove the transform carries
// no partner assumptions.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readCsv, transformToCanonical, parse } from './parser.mjs';
import { createCanonicalRecord, CANONICAL_FIELDS } from './canonical.mjs';

// Mock profile: generic headers, a made-up unit, a couple of coercers, and a record hook.
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

const csvText =
  'Ref,Name,Promo,Start,End,Qty,Amount,Curr\n' + 'R1,Doe,SAVE,2026-06-01,2026-06-03,2,199.50,USD';

test('maps headers per the profile and coerces mapped fields', () => {
  const [rec] = transformToCanonical(readCsv(csvText), mockProfile);
  assert.equal(rec.external_ref, 'R1');
  assert.equal(rec.customer_name, 'Doe');
  assert.equal(rec.promo_code, 'SAVE');
  assert.equal(rec.service_start, '2026-06-01');
  assert.equal(rec.service_end, '2026-06-03');
  assert.equal(rec.quantity, 2); // coerced to int
  assert.equal(rec.revenue_cents, 19950); // coerced to integer cents
  assert.equal(rec.currency, 'USD');
});

test('unit_label comes from the profile constant, not a column', () => {
  const [rec] = transformToCanonical(readCsv(csvText), mockProfile);
  assert.equal(rec.unit_label, 'widgets');
});

test('every record has the full canonical key set; unmapped fields stay null', () => {
  const noPromo = {
    map: { external_ref: 'Ref', quantity: 'Qty' },
    coerce: { quantity: (v) => Number.parseInt(v, 10) },
    unitLabel: 'widgets',
  };
  const [rec] = transformToCanonical(readCsv(csvText), noPromo);
  assert.deepEqual(Object.keys(rec), [...CANONICAL_FIELDS]);
  assert.equal(rec.external_ref, 'R1');
  assert.equal(rec.quantity, 2);
  // Fields the profile did not map:
  assert.equal(rec.promo_code, null);
  assert.equal(rec.customer_name, null);
  assert.equal(rec.currency, null);
});

test('the original row is retained verbatim on record.raw (header-keyed)', () => {
  const [rec] = transformToCanonical(readCsv(csvText), mockProfile);
  assert.deepEqual(rec.raw, {
    Ref: 'R1',
    Name: 'Doe',
    Promo: 'SAVE',
    Start: '2026-06-01',
    End: '2026-06-03',
    Qty: '2',
    Amount: '199.50',
    Curr: 'USD',
  });
});

test('coercers receive a context with field + header', () => {
  const seen = [];
  const spyProfile = {
    map: { external_ref: 'Ref' },
    coerce: {
      external_ref: (v, ctx) => {
        seen.push({ v, field: ctx.field, header: ctx.header, rowIndex: ctx.rowIndex });
        return v;
      },
    },
  };
  transformToCanonical(readCsv(csvText), spyProfile);
  assert.deepEqual(seen, [{ v: 'R1', field: 'external_ref', header: 'Ref', rowIndex: 0 }]);
});

test('optional record-level transform hook is applied last', () => {
  const withHook = {
    ...mockProfile,
    transform: (record) => ({ ...record, promo_code: record.promo_code?.toLowerCase() ?? null }),
  };
  const [rec] = transformToCanonical(readCsv(csvText), withHook);
  assert.equal(rec.promo_code, 'save'); // hook lowercased it
  assert.equal(rec.quantity, 2); // coercion still happened before the hook
});

test('one canonical record is produced per data row', () => {
  const many =
    'Ref,Name,Promo,Start,End,Qty,Amount,Curr\n' +
    'R1,A,,2026-06-01,2026-06-02,1,10.00,USD\n' +
    'R2,B,,2026-06-03,2026-06-05,2,20.00,USD\n' +
    'R3,C,,2026-06-06,2026-06-07,1,30.00,USD';
  const recs = transformToCanonical(readCsv(many), mockProfile);
  assert.equal(recs.length, 3);
  assert.deepEqual(
    recs.map((r) => r.external_ref),
    ['R1', 'R2', 'R3']
  );
});

test('short (ragged) rows do not throw; missing mapped cells become null', () => {
  // Row is missing the trailing Curr cell.
  const short =
    'Ref,Name,Promo,Start,End,Qty,Amount,Curr\n' + 'R1,Doe,SAVE,2026-06-01,2026-06-03,2,199.50';
  const [rec] = transformToCanonical(readCsv(short), mockProfile);
  assert.equal(rec.currency, null); // missing cell → null
  assert.equal(rec.external_ref, 'R1'); // present cells still mapped
  assert.equal(rec.raw.Curr, null); // raw reflects the missing cell too
});

test('canonical factory is INJECTABLE — the transform uses the one it is given', () => {
  let calls = 0;
  const spyFactory = () => {
    calls += 1;
    return createCanonicalRecord();
  };
  const recs = transformToCanonical(readCsv(csvText), mockProfile, spyFactory);
  assert.equal(calls, recs.length); // factory invoked once per row, not hard-coded
});

test('PARTNER-AGNOSTIC: a totally different profile works with no transform code change', () => {
  // Different partner, different headers, different unit, different coercion — same
  // transformToCanonical function, zero edits.
  const otherPartner = {
    map: { external_ref: 'booking_id', revenue_cents: 'total', quantity: 'seats' },
    coerce: {
      revenue_cents: (v) => Math.round(Number.parseFloat(v) * 100),
      quantity: (v) => Number.parseInt(v, 10),
    },
    unitLabel: 'seats',
  };
  const other = 'booking_id,total,seats\nX9,45.00,4';
  const [rec] = transformToCanonical(readCsv(other), otherPartner);
  assert.equal(rec.external_ref, 'X9');
  assert.equal(rec.revenue_cents, 4500);
  assert.equal(rec.quantity, 4);
  assert.equal(rec.unit_label, 'seats');
  assert.equal(rec.raw.booking_id, 'X9');
});

test('parse() convenience composes readCsv + transform (no file reading)', () => {
  const recs = parse(csvText, mockProfile);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].external_ref, 'R1');
  assert.equal(recs[0].revenue_cents, 19950);
});

test('malformed inputs throw TypeError', () => {
  assert.throws(() => transformToCanonical(null, mockProfile), TypeError);
  assert.throws(() => transformToCanonical({ headers: [] }, mockProfile), TypeError);
  assert.throws(() => transformToCanonical(readCsv(csvText), null), TypeError);
  assert.throws(() => transformToCanonical(readCsv(csvText), mockProfile, 'nope'), TypeError);
});
