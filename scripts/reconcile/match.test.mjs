// Tests for the reconciliation matching engine (M8).
// Run: node --test scripts/reconcile/match.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reconcile } from './match.mjs';
import { MATCH_TIER } from './rules.mjs';

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
  ref_code: 'BW26-AAAAAA',
  promo_code: 'ADVENTURE',
  checkin: '2026-06-10',
  created_at: '2026-06-10T12:00:00Z',
  status: 'clicked',
  ...over,
});

test('unique promo+arrival match pairs one line to one intent', () => {
  const plan = reconcile([line()], [intent({ ref_code: 'X' })]);
  assert.equal(plan.matches.length, 1);
  assert.equal(plan.matches[0].line.id, 'L1');
  assert.equal(plan.matches[0].intent.id, 'I1');
  assert.equal(plan.matches[0].tier, MATCH_TIER.PROMO_ARRIVAL);
  assert.equal(plan.ambiguous.length, 0);
  assert.equal(plan.unmatchedLines.length, 0);
  assert.equal(plan.unmatchedIntents.length, 0);
});

test('ref_code beats promo: strongest tier wins', () => {
  const l = line({ raw: { Ref: 'BW26-AAAAAA' } });
  const plan = reconcile([l], [intent()]);
  assert.equal(plan.matches[0].tier, MATCH_TIER.REF_CODE);
});

test('one intent → one line: a second line cannot claim a consumed intent', () => {
  // Two lines both promo+arrival-match the single intent. Stable order (external_ref) makes
  // CONF1 win; CONF2 then has no candidate and is unmatched.
  const l1 = line({ id: 'L1', external_ref: 'CONF1' });
  const l2 = line({ id: 'L2', external_ref: 'CONF2' });
  const plan = reconcile([l2, l1], [intent()]);
  assert.equal(plan.matches.length, 1);
  assert.equal(plan.matches[0].line.external_ref, 'CONF1');
  assert.equal(plan.unmatchedLines.length, 1);
  assert.equal(plan.unmatchedLines[0].external_ref, 'CONF2');
});

test('ambiguous: one line strongly matches two intents → NOT auto-matched', () => {
  const i1 = intent({ id: 'I1', ref_code: 'X' });
  const i2 = intent({ id: 'I2', ref_code: 'Y', created_at: '2026-06-10T13:00:00Z' });
  const plan = reconcile([line()], [i1, i2]);
  assert.equal(plan.matches.length, 0);
  assert.equal(plan.ambiguous.length, 1);
  assert.equal(plan.ambiguous[0].tier, MATCH_TIER.PROMO_ARRIVAL);
  assert.deepEqual(plan.ambiguous[0].candidateIntentIds.sort(), ['I1', 'I2']);
  // Both intents remain open (nothing consumed them).
  assert.equal(plan.unmatchedIntents.length, 2);
});

test('unmatched line: no candidate intent at any tier', () => {
  const plan = reconcile([line({ promo_code: 'NOPE' })], [intent({ ref_code: 'X' })]);
  assert.equal(plan.matches.length, 0);
  assert.equal(plan.unmatchedLines.length, 1);
  assert.equal(plan.unmatchedIntents.length, 1);
});

test('ref_code disambiguates where promo alone would be ambiguous', () => {
  // Two intents share the promo + arrival, but the line echoes I2's ref code → clean tier-1 match.
  const i1 = intent({ id: 'I1', ref_code: 'BW26-AAAAAA' });
  const i2 = intent({ id: 'I2', ref_code: 'BW26-BBBBBB', created_at: '2026-06-10T13:00:00Z' });
  const l = line({ raw: { Ref: 'BW26-BBBBBB' } });
  const plan = reconcile([l], [i1, i2]);
  assert.equal(plan.matches.length, 1);
  assert.equal(plan.matches[0].intent.id, 'I2');
  assert.equal(plan.matches[0].tier, MATCH_TIER.REF_CODE);
});

test('deterministic + idempotent: input order does not change the plan', () => {
  const l1 = line({ id: 'L1', external_ref: 'CONF1', promo_code: 'ADVENTURE', service_start: '2026-06-10' });
  const l2 = line({ id: 'L2', external_ref: 'CONF2', promo_code: 'SUMMER', service_start: '2026-07-05' });
  const i1 = intent({ id: 'I1', ref_code: 'X', promo_code: 'ADVENTURE', checkin: '2026-06-10' });
  const i2 = intent({ id: 'I2', ref_code: 'Y', promo_code: 'SUMMER', checkin: '2026-07-05', created_at: '2026-07-05T09:00:00Z' });

  const a = reconcile([l1, l2], [i1, i2]);
  const b = reconcile([l2, l1], [i2, i1]);
  const pairs = (p) => p.matches.map((m) => `${m.line.id}:${m.intent.id}`).sort();
  assert.deepEqual(pairs(a), pairs(b));
  assert.deepEqual(pairs(a), ['L1:I1', 'L2:I2']);
});

test('member last name lifts a match from tier 3 to tier 2', () => {
  const plan = reconcile([line()], [intent({ ref_code: 'X' })], {
    lastNameByIntentId: { I1: 'Wilson' },
  });
  assert.equal(plan.matches[0].tier, MATCH_TIER.PROMO_ARRIVAL_NAME);
});

test('throws on non-array input', () => {
  assert.throws(() => reconcile(null, []), TypeError);
  assert.throws(() => reconcile([], 'nope'), TypeError);
});
