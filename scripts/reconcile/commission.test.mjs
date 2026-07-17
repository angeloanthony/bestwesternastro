// Tests for commission + outcome derivation (M8).
// Run: node --test scripts/reconcile/commission.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OUTCOME, deriveOutcome, computeCommissionCents } from './commission.mjs';

test('deriveOutcome: positive revenue + nights → stayed', () => {
  assert.equal(deriveOutcome({ revenue_cents: 19950, quantity: 2 }), OUTCOME.STAYED);
});

test('deriveOutcome: non-positive revenue → cancelled (refund)', () => {
  assert.equal(deriveOutcome({ revenue_cents: 0, quantity: 2 }), OUTCOME.CANCELLED);
  assert.equal(deriveOutcome({ revenue_cents: -19950, quantity: 2 }), OUTCOME.CANCELLED);
});

test('deriveOutcome: non-positive nights → cancelled', () => {
  assert.equal(deriveOutcome({ revenue_cents: 100, quantity: 0 }), OUTCOME.CANCELLED);
});

test('deriveOutcome: missing fields default to stayed (nothing signals a cancel)', () => {
  assert.equal(deriveOutcome({}), OUTCOME.STAYED);
});

test('computeCommissionCents: stayed + rate → rounded cents', () => {
  assert.equal(computeCommissionCents(19950, 10), 1995);
  assert.equal(computeCommissionCents(20000, 12.5), 2500);
});

test('computeCommissionCents: rounds to the nearest cent', () => {
  // 19999 * 10% = 1999.9 → 2000
  assert.equal(computeCommissionCents(19999, 10), 2000);
  // 12345 * 12.5% = 1543.125 → 1543
  assert.equal(computeCommissionCents(12345, 12.5), 1543);
});

test('NEVER invents: null/undefined rate → null commission', () => {
  assert.equal(computeCommissionCents(19950, null), null);
  assert.equal(computeCommissionCents(19950, undefined), null);
});

test('non-finite rate or revenue → null', () => {
  assert.equal(computeCommissionCents(19950, Number.NaN), null);
  assert.equal(computeCommissionCents(null, 10), null);
  assert.equal(computeCommissionCents(undefined, 10), null);
});

test('cancelled/refunded → 0 commission even when a rate exists', () => {
  assert.equal(computeCommissionCents(19950, 10, { outcome: OUTCOME.CANCELLED }), 0);
  assert.equal(computeCommissionCents(-19950, 10, { outcome: 'cancelled' }), 0);
});
