// Tests for reconciliation persistence (M8).
// Run: node --test scripts/reconcile/persist.test.mjs
//
// No live database: a fake client records the update/select chains so we can assert exactly
// which tables were written, that writes are guarded by the source status, and that --dry-run
// performs no writes at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIntentUpdate,
  applyReconciliation,
  ageUnmatchedIntents,
  fetchCommissionPercent,
  createServiceClient,
  MATCHABLE_INTENT_STATUSES,
} from './persist.mjs';

// Fake update client: from(table).update(row).eq(...)/.in(...)[.select()] resolves to { error }.
// Records every write as { table, row, filters }. `errorFor(table)` can force a failure.
function fakeWriteClient(errorFor = () => null) {
  const writes = [];
  function chain(table, row) {
    const filters = [];
    const node = {
      eq(col, val) {
        filters.push(['eq', col, val]);
        return node;
      },
      in(col, vals) {
        filters.push(['in', col, vals]);
        return node;
      },
      lt(col, val) {
        filters.push(['lt', col, val]);
        return node;
      },
      select() {
        // terminal for the aging update (.select('id')): resolve with rows
        writes.push({ table, row, filters });
        const err = errorFor(table);
        return Promise.resolve(
          err ? { data: null, error: err } : { data: [{ id: 'x' }], error: null }
        );
      },
      then(resolve, reject) {
        // terminal when awaited without .select()
        writes.push({ table, row, filters });
        const err = errorFor(table);
        return Promise.resolve(err ? { error: err } : { error: null }).then(resolve, reject);
      },
    };
    return node;
  }
  const client = {
    from(table) {
      return { update: (row) => chain(table, row) };
    },
  };
  return { client, writes };
}

const match = (over = {}) => ({
  line: {
    id: 'L1',
    external_ref: 'CONF1',
    quantity: 2,
    revenue_cents: 19950,
    ...over.line,
  },
  intent: { id: 'I1', ...over.intent },
  tier: over.tier ?? 'promo+arrival',
  confidence: over.confidence ?? 'high',
});

const NOW = '2026-07-13T00:00:00.000Z';

// ── buildIntentUpdate (pure) ─────────────────────────────────────────────────
test('buildIntentUpdate: fills reconciliation columns + commission', () => {
  const { outcome, commission_cents, update } = buildIntentUpdate(match(), {
    commissionPercent: 10,
    now: NOW,
  });
  assert.equal(outcome, 'stayed');
  assert.equal(commission_cents, 1995);
  assert.equal(update.status, 'stayed');
  assert.equal(update.matched_at, NOW);
  assert.equal(update.confirmation_number, 'CONF1');
  assert.equal(update.room_nights, 2);
  assert.equal(update.revenue_cents, 19950);
  assert.equal(update.commission_cents, 1995);
  assert.match(update.notes, /promo\+arrival \(high\)/);
});

test('buildIntentUpdate: null rate → null commission (never invented)', () => {
  const { commission_cents, update } = buildIntentUpdate(match(), {
    commissionPercent: null,
    now: NOW,
  });
  assert.equal(commission_cents, null);
  assert.equal(update.commission_cents, null);
});

test('buildIntentUpdate: refund line → cancelled + 0 commission', () => {
  const { outcome, update } = buildIntentUpdate(
    match({ line: { id: 'L1', external_ref: 'CONF1', quantity: 1, revenue_cents: -19950 } }),
    { commissionPercent: 10, now: NOW }
  );
  assert.equal(outcome, 'cancelled');
  assert.equal(update.status, 'cancelled');
  assert.equal(update.commission_cents, 0);
});

// ── applyReconciliation ──────────────────────────────────────────────────────
const plan = (over = {}) => ({
  matches: over.matches ?? [match()],
  ambiguous: over.ambiguous ?? [],
  unmatchedLines: [],
  unmatchedIntents: [],
});

test('applyReconciliation: updates intent (guarded) then links line (guarded)', async () => {
  const { client, writes } = fakeWriteClient();
  const result = await applyReconciliation(client, plan(), { commissionPercent: 10, now: NOW });

  assert.equal(writes.length, 2);
  const [intentWrite, lineWrite] = writes;

  assert.equal(intentWrite.table, 'booking_intent');
  assert.equal(intentWrite.row.status, 'stayed');
  assert.deepEqual(intentWrite.filters[0], ['eq', 'id', 'I1']);
  assert.deepEqual(intentWrite.filters[1], ['in', 'status', MATCHABLE_INTENT_STATUSES]);

  assert.equal(lineWrite.table, 'partner_report_line');
  assert.equal(lineWrite.row.status, 'matched');
  assert.equal(lineWrite.row.booking_intent_id, 'I1');
  assert.deepEqual(lineWrite.filters[0], ['eq', 'id', 'L1']);
  assert.deepEqual(lineWrite.filters[1], ['eq', 'status', 'unmatched']); // never re-matches a matched line

  assert.equal(result.stayed, 1);
  assert.equal(result.roomNights, 2);
  assert.equal(result.revenueCents, 19950);
  assert.equal(result.commissionCents, 1995);
  assert.equal(result.applied.length, 1);
});

test('applyReconciliation: DRY RUN performs no writes but returns the same totals', async () => {
  const { client, writes } = fakeWriteClient();
  const result = await applyReconciliation(client, plan(), {
    commissionPercent: 10,
    now: NOW,
    dryRun: true,
  });
  assert.equal(writes.length, 0); // NO writes
  assert.equal(result.stayed, 1);
  assert.equal(result.commissionCents, 1995);
  assert.equal(result.applied.length, 1);
});

test('applyReconciliation: dry run needs no client', async () => {
  const result = await applyReconciliation(null, plan(), {
    commissionPercent: 10,
    now: NOW,
    dryRun: true,
  });
  assert.equal(result.applied.length, 1);
});

test('applyReconciliation: null rate → commission left NULL and counted', async () => {
  const { client } = fakeWriteClient();
  const result = await applyReconciliation(client, plan(), { commissionPercent: null, now: NOW });
  assert.equal(result.commissionCents, 0);
  assert.equal(result.commissionNullCount, 1);
});

test('applyReconciliation: ambiguous lines are flagged, not matched', async () => {
  const { client, writes } = fakeWriteClient();
  const result = await applyReconciliation(
    client,
    plan({
      matches: [],
      ambiguous: [{ line: { id: 'L9' }, tier: 'promo+arrival', candidateIntentIds: ['I1', 'I2'] }],
    }),
    { commissionPercent: 10, now: NOW }
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, 'partner_report_line');
  assert.equal(writes[0].row.status, 'ambiguous');
  assert.deepEqual(writes[0].filters, [
    ['eq', 'id', 'L9'],
    ['eq', 'status', 'unmatched'],
  ]);
  assert.equal(result.ambiguousFlagged, 1);
});

test('applyReconciliation: aborts (not fail-open) when the intent update errors', async () => {
  const { client } = fakeWriteClient((table) =>
    table === 'booking_intent' ? { message: 'boom' } : null
  );
  await assert.rejects(
    () => applyReconciliation(client, plan(), { commissionPercent: 10, now: NOW }),
    /booking_intent update failed.*boom/
  );
});

test('applyReconciliation: cancelled match counts as cancelled, not a stay', async () => {
  const { client } = fakeWriteClient();
  const result = await applyReconciliation(
    client,
    plan({
      matches: [match({ line: { id: 'L1', external_ref: 'C', quantity: 1, revenue_cents: 0 } })],
    }),
    { commissionPercent: 10, now: NOW }
  );
  assert.equal(result.stayed, 0);
  assert.equal(result.cancelled, 1);
  assert.equal(result.revenueCents, 0);
});

test('applyReconciliation: requires opts.now', async () => {
  await assert.rejects(
    () => applyReconciliation(fakeWriteClient().client, plan(), { commissionPercent: 10 }),
    TypeError
  );
});

// ── ageUnmatchedIntents ──────────────────────────────────────────────────────
test('ageUnmatchedIntents: updates open intents older than the cutoff to no_match', async () => {
  const { client, writes } = fakeWriteClient();
  const n = await ageUnmatchedIntents(client, {
    partner_slug: 'best-western-vernal',
    cutoffIso: '2026-06-01T00:00:00Z',
  });
  assert.equal(n, 1);
  assert.equal(writes[0].table, 'booking_intent');
  assert.equal(writes[0].row.status, 'no_match');
  assert.deepEqual(writes[0].filters, [
    ['eq', 'partner_slug', 'best-western-vernal'],
    ['in', 'status', MATCHABLE_INTENT_STATUSES],
    ['lt', 'created_at', '2026-06-01T00:00:00Z'],
  ]);
});

test('ageUnmatchedIntents: requires a cutoff', async () => {
  await assert.rejects(
    () => ageUnmatchedIntents(fakeWriteClient().client, { partner_slug: 'bw' }),
    TypeError
  );
});

// ── fetchCommissionPercent ───────────────────────────────────────────────────
function fakeSelectClient(result) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => result };
            },
          };
        },
      };
    },
  };
}

test('fetchCommissionPercent: returns the numeric rate', async () => {
  const pct = await fetchCommissionPercent(
    fakeSelectClient({ data: { commission_percent: 12.5 }, error: null }),
    'bw'
  );
  assert.equal(pct, 12.5);
});

test('fetchCommissionPercent: absent partner / unset rate → null (never invented)', async () => {
  assert.equal(
    await fetchCommissionPercent(fakeSelectClient({ data: null, error: null }), 'bw'),
    null
  );
  assert.equal(
    await fetchCommissionPercent(
      fakeSelectClient({ data: { commission_percent: null }, error: null }),
      'bw'
    ),
    null
  );
});

// ── createServiceClient ──────────────────────────────────────────────────────
test('createServiceClient: throws when env vars are missing', () => {
  assert.throws(() => createServiceClient({}), /Missing credentials/);
});

test('createServiceClient: builds a client when env is present', () => {
  const client = createServiceClient({
    PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'k',
  });
  assert.equal(typeof client.from, 'function');
});
