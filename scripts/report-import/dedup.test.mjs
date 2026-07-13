// Tests for duplicate-detection helpers (M6 · T09).
// Run: node --test scripts/report-import/dedup.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sha256Hex,
  naturalKey,
  formatHashToken,
  parseHashToken,
  reportHash,
  periodsOverlap,
  decideImport,
  DECISION,
} from './dedup.mjs';

// A known SHA-256 vector: the empty string.
const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// ── sha256Hex ────────────────────────────────────────────────────────────────
test('sha256Hex: matches the known empty-string vector', () => {
  assert.equal(sha256Hex(''), EMPTY_SHA);
});

test('sha256Hex: identical bytes produce identical hashes', () => {
  const csv = 'a,b\n1,2\n';
  assert.equal(sha256Hex(csv), sha256Hex(csv));
  assert.equal(sha256Hex(csv), sha256Hex(Buffer.from(csv))); // string and Buffer agree
});

test('sha256Hex: any byte difference changes the hash', () => {
  assert.notEqual(sha256Hex('a,b\n1,2\n'), sha256Hex('a,b\n1,3\n'));
  assert.notEqual(sha256Hex('a,b\n1,2\n'), sha256Hex('a,b\n1,2')); // trailing newline matters
});

test('sha256Hex: throws on non-string / non-Buffer', () => {
  assert.throws(() => sha256Hex(null), TypeError);
  assert.throws(() => sha256Hex(42), TypeError);
});

// ── naturalKey ───────────────────────────────────────────────────────────────
test('naturalKey: composes partner + period into a stable string', () => {
  assert.equal(
    naturalKey({ partner_slug: 'bw', period_start: '2026-06-01', period_end: '2026-06-30' }),
    'bw:2026-06-01:2026-06-30'
  );
});

test('naturalKey: differs when any component differs', () => {
  const base = { partner_slug: 'bw', period_start: '2026-06-01', period_end: '2026-06-30' };
  assert.notEqual(naturalKey(base), naturalKey({ ...base, period_end: '2026-06-29' }));
  assert.notEqual(naturalKey(base), naturalKey({ ...base, partner_slug: 'other' }));
});

// ── hash token format / parse ────────────────────────────────────────────────
test('formatHashToken / parseHashToken: round-trip', () => {
  const token = formatHashToken(EMPTY_SHA);
  assert.equal(token, `sha256:${EMPTY_SHA}`);
  assert.equal(parseHashToken(token), EMPTY_SHA);
});

test('parseHashToken: extracts a token embedded in a larger note', () => {
  const note = `imported by rocco; 2 warnings; sha256:${EMPTY_SHA}; ok`;
  assert.equal(parseHashToken(note), EMPTY_SHA);
});

test('parseHashToken: returns null when no token is present', () => {
  assert.equal(parseHashToken('no hash here'), null);
  assert.equal(parseHashToken(null), null);
});

test('formatHashToken: throws on a non-hex / wrong-length input', () => {
  assert.throws(() => formatHashToken('deadbeef'), TypeError);
  assert.throws(() => formatHashToken('zz'), TypeError);
});

// ── reportHash ───────────────────────────────────────────────────────────────
test('reportHash: prefers an explicit hash field', () => {
  assert.equal(reportHash({ hash: EMPTY_SHA }), EMPTY_SHA);
});

test('reportHash: falls back to a token in source_note', () => {
  assert.equal(reportHash({ source_note: `run; sha256:${EMPTY_SHA}` }), EMPTY_SHA);
});

test('reportHash: falls back to hashing stored raw_csv', () => {
  const raw = 'a,b\n1,2\n';
  assert.equal(reportHash({ raw_csv: raw }), sha256Hex(raw));
});

test('reportHash: null when nothing is available', () => {
  assert.equal(reportHash({}), null);
  assert.equal(reportHash(null), null);
});

// ── periodsOverlap ───────────────────────────────────────────────────────────
test('periodsOverlap: true for intersecting ranges, false for disjoint', () => {
  assert.equal(periodsOverlap('2026-06-01', '2026-06-30', '2026-06-15', '2026-07-15'), true);
  assert.equal(periodsOverlap('2026-06-01', '2026-06-30', '2026-07-01', '2026-07-31'), false);
});

test('periodsOverlap: touching endpoints count as overlap; missing → false', () => {
  assert.equal(periodsOverlap('2026-06-01', '2026-06-30', '2026-06-30', '2026-07-05'), true);
  assert.equal(periodsOverlap('2026-06-01', '', '2026-06-30', '2026-07-05'), false);
});

// ── decideImport ─────────────────────────────────────────────────────────────
const incoming = {
  newHash: sha256Hex('NEW FILE CONTENT'),
  partner_slug: 'bw',
  period_start: '2026-06-01',
  period_end: '2026-06-30',
};

test('decideImport: ALLOW when there are no existing reports', () => {
  const d = decideImport(incoming, []);
  assert.equal(d.decision, DECISION.ALLOW);
  assert.deepEqual(d.conflicts, []);
});

test('decideImport: BLOCK_DUPLICATE on identical bytes (via stored raw_csv)', () => {
  const existing = [
    {
      partner_slug: 'bw',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: 'NEW FILE CONTENT', // hashes to incoming.newHash
    },
  ];
  const d = decideImport(incoming, existing);
  assert.equal(d.decision, DECISION.BLOCK_DUPLICATE);
  assert.equal(d.conflicts[0].type, 'same-hash');
});

test('decideImport: BLOCK_DUPLICATE on identical hash (via source_note token)', () => {
  const existing = [
    {
      partner_slug: 'bw',
      period_start: '2026-05-01',
      period_end: '2026-05-31', // different period, but same file
      source_note: `prior; ${formatHashToken(incoming.newHash)}`,
    },
  ];
  const d = decideImport(incoming, existing);
  assert.equal(d.decision, DECISION.BLOCK_DUPLICATE); // hash wins regardless of period
});

test('decideImport: WARN_OVERLAP on same partner+period, different content', () => {
  const existing = [
    {
      partner_slug: 'bw',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: 'DIFFERENT CONTENT',
    },
  ];
  const d = decideImport(incoming, existing);
  assert.equal(d.decision, DECISION.WARN_OVERLAP);
  assert.equal(d.conflicts[0].type, 'same-period');
  assert.match(d.reason, /--replace/);
});

test('decideImport: WARN_OVERLAP on an overlapping (non-identical) period', () => {
  const existing = [
    {
      partner_slug: 'bw',
      period_start: '2026-06-15',
      period_end: '2026-07-15',
      raw_csv: 'DIFFERENT CONTENT',
    },
  ];
  const d = decideImport(incoming, existing);
  assert.equal(d.decision, DECISION.WARN_OVERLAP);
  assert.equal(d.conflicts[0].type, 'overlap');
});

test('decideImport: ALLOW for a disjoint period with different content', () => {
  const existing = [
    {
      partner_slug: 'bw',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      raw_csv: 'DIFFERENT CONTENT',
    },
  ];
  assert.equal(decideImport(incoming, existing).decision, DECISION.ALLOW);
});

test('decideImport: a different partner is ignored entirely', () => {
  const existing = [
    {
      partner_slug: 'other-partner',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: 'NEW FILE CONTENT', // same bytes, but different partner
    },
  ];
  assert.equal(decideImport(incoming, existing).decision, DECISION.ALLOW);
});

test('decideImport: same-hash takes precedence over same-period', () => {
  const existing = [
    // same period, different content → would be a warn on its own
    {
      partner_slug: 'bw',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      raw_csv: 'DIFFERENT CONTENT',
    },
    // identical bytes elsewhere → must block
    {
      partner_slug: 'bw',
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      raw_csv: 'NEW FILE CONTENT',
    },
  ];
  assert.equal(decideImport(incoming, existing).decision, DECISION.BLOCK_DUPLICATE);
});

test('decideImport: throws on malformed input', () => {
  assert.throws(() => decideImport({ partner_slug: 'bw' }, []), TypeError); // no newHash
  assert.throws(() => decideImport(incoming, 'not-an-array'), TypeError);
});
