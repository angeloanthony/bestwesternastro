// Tests for the partner profile registry (M6 · T04).
// Run: node --test scripts/report-import/profiles.test.mjs
//
// Covers: the reusable coercers convert sample date/currency/count values; the BW profile
// maps every required canonical field; getProfile resolves known slugs and rejects unknown
// ones; and — the load-bearing claim of the whole design — a SECOND dummy partner drops in
// through defineProfile with zero core edits, including status/cancellation handling.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getProfile,
  registeredSlugs,
  bestWesternVernal,
  defineProfile,
  makeDateParser,
  makeCurrencyParser,
  makeIntegerParser,
  makeStatusMapper,
} from './profiles.mjs';
import { parse } from './parser.mjs';
import { validateRecords, REQUIRED_FIELDS } from './validate.mjs';

// ── Coercers ──────────────────────────────────────────────────────────────────

test('date parser: MDY normalises to ISO; ISO passes through; blank → null', () => {
  const mdy = makeDateParser({ order: 'MDY' });
  assert.equal(mdy('06/01/2026'), '2026-06-01');
  assert.equal(mdy('6/1/2026'), '2026-06-01'); // unpadded
  assert.equal(mdy('2026-06-01'), '2026-06-01'); // already ISO
  assert.equal(mdy('06/01/26'), '2026-06-01'); // 2-digit year
  assert.equal(mdy(''), null);
  assert.equal(mdy(null), null);
  assert.equal(mdy('not-a-date'), 'not-a-date'); // unparseable → raw, validation flags it
});

test('date parser: DMY and YMD orders', () => {
  assert.equal(makeDateParser({ order: 'DMY' })('01/06/2026'), '2026-06-01');
  assert.equal(makeDateParser({ order: 'YMD' })('2026/6/1'), '2026-06-01');
});

test('currency parser: symbols, thousands, negatives, and parentheses', () => {
  const usd = makeCurrencyParser({
    symbols: ['$', 'USD'],
    thousandsSeparator: ',',
    decimalSeparator: '.',
  });
  assert.equal(usd('$1,299.50'), 129950);
  assert.equal(usd('1299.5'), 129950);
  assert.equal(usd('USD 40.00'), 4000);
  assert.equal(usd('-50.00'), -5000); // leading minus → refund
  assert.equal(usd('($50.00)'), -5000); // accounting parentheses → refund
  assert.equal(usd('0'), 0);
  assert.equal(usd(''), null);
  assert.equal(usd('n/a'), null); // unparseable
});

test('currency parser: European decimal/thousands separators', () => {
  const eur = makeCurrencyParser({
    symbols: ['€'],
    thousandsSeparator: '.',
    decimalSeparator: ',',
  });
  assert.equal(eur('€1.299,50'), 129950);
});

test('integer (room-night) parser', () => {
  const q = makeIntegerParser();
  assert.equal(q('3'), 3);
  assert.equal(q(' 12 '), 12);
  assert.equal(q(''), null);
  assert.equal(q('2.5'), null); // non-integer → null (validation rejects)
  assert.equal(q('abc'), null);
});

test('status mapper: case-insensitive with fallback', () => {
  const m = makeStatusMapper({
    map: { Confirmed: 'confirmed', Cancelled: 'cancelled' },
    fallback: 'unknown',
  });
  assert.equal(m('confirmed'), 'confirmed');
  assert.equal(m('CANCELLED'), 'cancelled');
  assert.equal(m('whatever'), 'unknown');
  assert.equal(m(''), 'unknown');
});

// ── Best Western profile ────────────────────────────────────────────────────────

test('getProfile resolves the BW slug and rejects unknown / non-string slugs', () => {
  assert.equal(getProfile('best-western-vernal'), bestWesternVernal);
  assert.equal(getProfile('no-such-partner'), null);
  assert.equal(getProfile(undefined), null);
  assert.equal(getProfile(42), null);
  assert.deepEqual(registeredSlugs(), ['best-western-vernal']);
});

test('BW profile maps or constant-covers every REQUIRED canonical field', () => {
  const p = bestWesternVernal;
  for (const field of REQUIRED_FIELDS) {
    const covered =
      field in p.map || field in p.constants || (field === 'unit_label' && p.unitLabel != null);
    assert.ok(covered, `required field '${field}' is not covered by the BW profile`);
  }
  assert.equal(p.unitLabel, 'room_nights');
  assert.equal(p.constants.currency, 'USD');
  assert.equal(p.encoding.charset, 'utf-8');
});

test('BW profile: a clean sample CSV normalises and passes validation', () => {
  const csv =
    'Confirmation #,Guest Name,Rate / Promo,Arrival,Departure,Nights,Room Revenue\n' +
    'BW-1001,"Doe, Jane",ADVENTURE,06/01/2026,06/03/2026,2,"$1,299.50"';
  const [rec] = parse(csv, bestWesternVernal);
  assert.equal(rec.external_ref, 'BW-1001');
  assert.equal(rec.customer_name, 'Doe, Jane');
  assert.equal(rec.promo_code, 'ADVENTURE');
  assert.equal(rec.service_start, '2026-06-01');
  assert.equal(rec.service_end, '2026-06-03');
  assert.equal(rec.quantity, 2);
  assert.equal(rec.unit_label, 'room_nights');
  assert.equal(rec.revenue_cents, 129950);
  assert.equal(rec.currency, 'USD'); // constant, not a column
  assert.deepEqual(rec.raw['Confirmation #'], 'BW-1001'); // original row retained

  const manifest = validateRecords(parse(csv, bestWesternVernal));
  assert.equal(manifest.ok, true);
  assert.equal(manifest.errors.length, 0);
});

test('BW profile: a negative Room Revenue refund is preserved (and validation warns)', () => {
  const csv =
    'Confirmation #,Guest Name,Rate / Promo,Arrival,Departure,Nights,Room Revenue\n' +
    'BW-1002,"Roe, Sam",ADVENTURE,06/05/2026,06/06/2026,1,($120.00)';
  const [rec] = parse(csv, bestWesternVernal);
  assert.equal(rec.revenue_cents, -12000);
  const manifest = validateRecords([rec]);
  assert.equal(manifest.ok, true); // negative revenue is a warning, not fatal
  assert.ok(manifest.warnings.some((w) => w.code === 'negative_revenue'));
});

// ── Extensibility: a second partner, no core edits ───────────────────────────────

test('a second dummy partner registers via defineProfile with different everything', () => {
  const dummy = defineProfile({
    slug: 'acme-tours',
    acceptedHeaders: ['booking_id', 'pax_name', 'code', 'start', 'end', 'seats', 'total', 'state'],
    map: {
      external_ref: 'booking_id',
      customer_name: 'pax_name',
      promo_code: 'code',
      service_start: 'start',
      service_end: 'end',
      quantity: 'seats',
      revenue_cents: 'total',
    },
    parsers: {
      date: makeDateParser({ order: 'DMY' }),
      currency: makeCurrencyParser({
        symbols: ['€'],
        thousandsSeparator: '.',
        decimalSeparator: ',',
      }),
      roomNights: makeIntegerParser(),
    },
    constants: { currency: 'EUR' },
    unitLabel: 'seats',
    reservationStatus: {
      header: 'state',
      map: { OK: 'confirmed', X: 'cancelled' },
      fallback: 'confirmed',
    },
    cancellation: { refundStatuses: ['cancelled'], negateRevenue: true },
  });

  const csv =
    'booking_id,pax_name,code,start,end,seats,total,state\n' +
    'A1,"Alpha",SPRING,01/06/2026,05/06/2026,4,"€45,00",OK\n' +
    'A2,"Beta",SPRING,02/06/2026,03/06/2026,2,"€20,00",X';
  const recs = parse(csv, dummy);

  // Confirmed row: normal.
  assert.equal(recs[0].external_ref, 'A1');
  assert.equal(recs[0].service_start, '2026-06-01'); // DMY parsed
  assert.equal(recs[0].quantity, 4);
  assert.equal(recs[0].unit_label, 'seats');
  assert.equal(recs[0].revenue_cents, 4500);
  assert.equal(recs[0].currency, 'EUR');

  // Cancelled row with negateRevenue opt-in: positive revenue flipped to a refund.
  assert.equal(recs[1].revenue_cents, -2000);

  // And it slots into the same transform + validation with no core change.
  assert.equal(validateRecords(recs).ok, true);
});

test('defineProfile rejects a config that leaves a required field uncovered', () => {
  assert.throws(
    () =>
      defineProfile({
        slug: 'broken',
        map: { external_ref: 'id' }, // missing service dates, quantity, revenue, etc.
        unitLabel: 'things',
      }),
    /does not cover required canonical field/
  );
});

test('defineProfile rejects an unknown canonical field and a missing slug', () => {
  assert.throws(
    () => defineProfile({ slug: 'x', map: { not_a_field: 'H' } }),
    /unknown canonical field/
  );
  assert.throws(() => defineProfile({ map: {} }), /requires a non-empty string slug/);
});
