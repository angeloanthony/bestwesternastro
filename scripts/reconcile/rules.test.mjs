// Tests for the confidence-based matching rules (M8).
// Run: node --test scripts/reconcile/rules.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MATCH_TIER,
  CONFIDENCE,
  normalizeCode,
  reportedLastName,
  dayDistance,
  arrivalWithinWindow,
  lineRefTokens,
  classify,
} from './rules.mjs';

// ── small pure helpers ───────────────────────────────────────────────────────
test('normalizeCode: trims + uppercases; blank/non-string → null', () => {
  assert.equal(normalizeCode('  adventure '), 'ADVENTURE');
  assert.equal(normalizeCode('BW26-7q3k9f'), 'BW26-7Q3K9F');
  assert.equal(normalizeCode(''), null);
  assert.equal(normalizeCode('   '), null);
  assert.equal(normalizeCode(null), null);
  assert.equal(normalizeCode(42), null);
});

test('reportedLastName: handles "Last, First" and "First Last"', () => {
  assert.equal(reportedLastName('Wilson, Dave'), 'wilson');
  assert.equal(reportedLastName('Dave Wilson'), 'wilson');
  assert.equal(reportedLastName('  Cassidy , Butch '), 'cassidy');
  assert.equal(reportedLastName(''), null);
  assert.equal(reportedLastName(null), null);
});

test('dayDistance: whole-day absolute distance; null on bad input', () => {
  assert.equal(dayDistance('2026-06-10', '2026-06-10'), 0);
  assert.equal(dayDistance('2026-06-10', '2026-06-11'), 1);
  assert.equal(dayDistance('2026-06-11', '2026-06-10'), 1);
  assert.equal(dayDistance('2026-06-10', '2026-06-13'), 3);
  assert.equal(dayDistance('nope', '2026-06-10'), null);
  assert.equal(dayDistance(null, null), null);
});

test('arrivalWithinWindow: inclusive ±window', () => {
  assert.equal(arrivalWithinWindow('2026-06-10', '2026-06-11', 1), true);
  assert.equal(arrivalWithinWindow('2026-06-10', '2026-06-12', 1), false);
  assert.equal(arrivalWithinWindow('2026-06-10', '2026-06-12', 2), true);
  assert.equal(arrivalWithinWindow(null, '2026-06-10', 1), false);
});

test('lineRefTokens: gathers external_ref + raw string/number values, normalized', () => {
  const tokens = lineRefTokens({
    external_ref: 'CONF123',
    raw: { 'Ref Code': 'bw26-7q3k9f', Nights: 2, Guest: 'Wilson, Dave' },
  });
  assert.ok(tokens.has('CONF123'));
  assert.ok(tokens.has('BW26-7Q3K9F'));
  assert.ok(tokens.has('2'));
  assert.ok(tokens.has('WILSON, DAVE'));
});

// ── classify: the tier ladder ────────────────────────────────────────────────
const line = (over = {}) => ({
  id: 'L1',
  external_ref: 'CONF1',
  customer_name: 'Wilson, Dave',
  promo_code: 'ADVENTURE',
  service_start: '2026-06-10',
  quantity: 2,
  revenue_cents: 19950,
  raw: {},
  ...over,
});
const intent = (over = {}) => ({
  id: 'I1',
  ref_code: 'BW26-7Q3K9F',
  promo_code: 'ADVENTURE',
  checkin: '2026-06-10',
  ...over,
});

test('tier 1 REF_CODE: ref code echoed in the line wins outright', () => {
  const l = line({ raw: { 'Ref Code': 'bw26-7q3k9f' }, promo_code: null });
  const c = classify(l, intent());
  assert.deepEqual(c, { tier: MATCH_TIER.REF_CODE, confidence: CONFIDENCE.HIGH });
});

test('tier 2 PROMO_ARRIVAL_NAME: promo + arrival + last name', () => {
  const c = classify(line(), intent({ ref_code: 'OTHER' }), { intentLastName: 'Wilson' });
  assert.deepEqual(c, { tier: MATCH_TIER.PROMO_ARRIVAL_NAME, confidence: CONFIDENCE.HIGH });
});

test('tier 3 PROMO_ARRIVAL: promo + arrival, no name available', () => {
  const c = classify(line(), intent({ ref_code: 'OTHER' }));
  assert.deepEqual(c, { tier: MATCH_TIER.PROMO_ARRIVAL, confidence: CONFIDENCE.HIGH });
});

test('tier 3 not 2 when the last name disagrees', () => {
  const c = classify(line(), intent({ ref_code: 'OTHER' }), { intentLastName: 'Cassidy' });
  assert.equal(c.tier, MATCH_TIER.PROMO_ARRIVAL);
});

test('tier 4 PROMO_ONLY: promo matches but arrival is outside the window → low confidence', () => {
  const c = classify(line({ service_start: '2026-06-20' }), intent({ ref_code: 'OTHER' }));
  assert.deepEqual(c, { tier: MATCH_TIER.PROMO_ONLY, confidence: CONFIDENCE.LOW });
});

test('no match when promo differs and no ref code', () => {
  const c = classify(line({ promo_code: 'OTHER' }), intent({ ref_code: 'NOPE' }));
  assert.equal(c, null);
});

test('arrival window is configurable', () => {
  const l = line({ service_start: '2026-06-13' });
  assert.equal(classify(l, intent({ ref_code: 'X' }), { windowDays: 1 }).tier, MATCH_TIER.PROMO_ONLY);
  assert.equal(classify(l, intent({ ref_code: 'X' }), { windowDays: 3 }).tier, MATCH_TIER.PROMO_ARRIVAL);
});
