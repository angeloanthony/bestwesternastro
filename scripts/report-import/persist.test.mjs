// Tests for report-header persistence (M6 · T12).
// Run: node --test scripts/report-import/persist.test.mjs
//
// No live database: a fake client records the builder chain (from → insert → select →
// single) so we can assert exactly one row is inserted into partner_report and that
// partner_report_line is never touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHeaderRow,
  insertReport,
  createServiceClient,
  buildLineRow,
  insertLines,
  LINE_BATCH_SIZE,
  deleteReport,
  persistReport,
} from './persist.mjs';
import { createCanonicalRecord } from './canonical.mjs';

// Fake Supabase client capturing calls; `result` is what single() resolves to.
function fakeClient(result) {
  const calls = { tables: [], inserts: [], selects: [], singles: 0 };
  const client = {
    from(table) {
      calls.tables.push(table);
      return {
        insert(row) {
          calls.inserts.push({ table, row });
          return {
            select(cols) {
              calls.selects.push(cols);
              return {
                single: async () => {
                  calls.singles += 1;
                  return result;
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const meta = {
  partner_slug: 'best-western-vernal',
  period_start: '2026-06-01',
  period_end: '2026-06-30',
  source_note: 'imported by rocco; sha256:abc',
  raw_csv: 'Ref,Amount\nR1,100\n',
  reconciled_by: 'rocco',
};

// ── buildHeaderRow (pure) ────────────────────────────────────────────────────
test('buildHeaderRow: whitelists provided fields', () => {
  assert.deepEqual(buildHeaderRow(meta), {
    partner_slug: 'best-western-vernal',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    source_note: 'imported by rocco; sha256:abc',
    raw_csv: 'Ref,Amount\nR1,100\n',
    reconciled_by: 'rocco',
  });
});

test('buildHeaderRow: never sets received_at (DB defaults now())', () => {
  assert.ok(!('received_at' in buildHeaderRow(meta)));
});

test('buildHeaderRow: drops unknown / out-of-scope keys', () => {
  const row = buildHeaderRow({
    ...meta,
    id: 'forced',
    lines: [1, 2, 3],
    commission_cents: 500,
    status: 'matched',
  });
  assert.ok(!('id' in row));
  assert.ok(!('lines' in row));
  assert.ok(!('commission_cents' in row));
  assert.ok(!('status' in row));
});

test('buildHeaderRow: omits optional fields that are undefined', () => {
  const row = buildHeaderRow({ partner_slug: 'p', raw_csv: 'x' });
  assert.deepEqual(row, { partner_slug: 'p', raw_csv: 'x' });
});

test('buildHeaderRow: throws when partner_slug is missing/blank', () => {
  assert.throws(() => buildHeaderRow({ raw_csv: 'x' }), TypeError);
  assert.throws(() => buildHeaderRow({ partner_slug: '  ', raw_csv: 'x' }), TypeError);
});

test('buildHeaderRow: throws when raw_csv is missing/empty', () => {
  assert.throws(() => buildHeaderRow({ partner_slug: 'p' }), TypeError);
  assert.throws(() => buildHeaderRow({ partner_slug: 'p', raw_csv: '' }), TypeError);
});

test('buildHeaderRow: throws on a non-object', () => {
  assert.throws(() => buildHeaderRow(null), TypeError);
});

// ── insertReport (injected client) ───────────────────────────────────────────
test('insertReport: inserts exactly one row into partner_report and returns its id', async () => {
  const { client, calls } = fakeClient({ data: { id: 'rep-123' }, error: null });
  const id = await insertReport(client, meta);

  assert.equal(id, 'rep-123');
  assert.deepEqual(calls.tables, ['partner_report']); // only the header table
  assert.equal(calls.inserts.length, 1); // exactly one insert
  assert.ok(!Array.isArray(calls.inserts[0].row)); // a single object, not a batch
  assert.equal(calls.inserts[0].row.partner_slug, 'best-western-vernal');
  assert.deepEqual(calls.selects, ['id']);
  assert.equal(calls.singles, 1);
});

test('insertReport: NEVER touches partner_report_line', async () => {
  const { client, calls } = fakeClient({ data: { id: 'rep-1' }, error: null });
  await insertReport(client, meta);
  assert.ok(!calls.tables.includes('partner_report_line'));
});

test('insertReport: throws (aborts) when the insert errors', async () => {
  const { client } = fakeClient({ data: null, error: { message: 'duplicate key value' } });
  await assert.rejects(() => insertReport(client, meta), /partner_report insert failed/);
  await assert.rejects(() => insertReport(client, meta), /duplicate key value/);
  await assert.rejects(() => insertReport(client, meta), /best-western-vernal/);
});

test('insertReport: throws when no id comes back', async () => {
  const { client } = fakeClient({ data: null, error: null });
  await assert.rejects(() => insertReport(client, meta), /returned no id/);
});

test('insertReport: throws TypeError without a valid client', async () => {
  await assert.rejects(() => insertReport(null, meta), TypeError);
  await assert.rejects(() => insertReport({}, meta), TypeError);
});

test('insertReport: validates metadata before calling the client', async () => {
  const { client, calls } = fakeClient({ data: { id: 'x' }, error: null });
  await assert.rejects(() => insertReport(client, { partner_slug: 'p' }), TypeError); // no raw_csv
  assert.equal(calls.tables.length, 0); // never reached the client
});

// ── createServiceClient (env helper) ─────────────────────────────────────────
test('createServiceClient: throws when env vars are missing', () => {
  assert.throws(() => createServiceClient({}), /Missing credentials/);
  assert.throws(() => createServiceClient({ PUBLIC_SUPABASE_URL: 'x' }), /Missing credentials/);
});

test('createServiceClient: returns a client when env is present', () => {
  const client = createServiceClient({
    PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  });
  assert.equal(typeof client.from, 'function');
});

// ── insertLines (T13) ────────────────────────────────────────────────────────
// Fake client for the batch-insert pattern: from(table).insert(batch) is awaitable and
// resolves to a PostgREST-like { error }. `resultFor(batch, index)` lets a test inject a
// failure on a chosen batch.
function fakeLineClient(resultFor = () => ({ error: null })) {
  const calls = { tables: [], batches: [] };
  const client = {
    from(table) {
      calls.tables.push(table);
      return {
        insert(batch) {
          const index = calls.batches.length;
          calls.batches.push({ table, batch });
          return Promise.resolve(resultFor(batch, index));
        },
      };
    },
  };
  return { client, calls };
}

const rec = (over = {}) =>
  createCanonicalRecord({
    external_ref: 'R1',
    customer_name: 'Doe',
    promo_code: 'ADVENTURE',
    service_start: '2026-06-01',
    service_end: '2026-06-03',
    quantity: 2,
    unit_label: 'room_nights',
    revenue_cents: 19950,
    currency: 'USD',
    raw: { Ref: 'R1' },
    ...over,
  });

const LINES_OPTS = { partner_slug: 'best-western-vernal' };

test('buildLineRow: stamps fixed columns and maps canonical fields', () => {
  const row = buildLineRow('rep-1', 'best-western-vernal', rec());
  assert.equal(row.report_id, 'rep-1');
  assert.equal(row.partner_slug, 'best-western-vernal');
  assert.equal(row.booking_intent_id, null);
  assert.equal(row.status, 'unmatched');
  assert.equal(row.external_ref, 'R1');
  assert.equal(row.quantity, 2);
  assert.equal(row.revenue_cents, 19950);
  assert.equal(row.unit_label, 'room_nights');
  assert.deepEqual(row.raw, { Ref: 'R1' });
});

test('buildLineRow: missing canonical fields become null', () => {
  const row = buildLineRow('rep-1', 'bw', createCanonicalRecord({ external_ref: 'X' }));
  assert.equal(row.external_ref, 'X');
  assert.equal(row.promo_code, null);
  assert.equal(row.revenue_cents, null);
  assert.equal(row.raw, null);
});

test('insertLines: inserts all rows and returns the count', async () => {
  const { client, calls } = fakeLineClient();
  const n = await insertLines(client, 'rep-1', [rec(), rec({ external_ref: 'R2' })], LINES_OPTS);
  assert.equal(n, 2);
  assert.deepEqual(calls.tables, ['partner_report_line']);
  assert.equal(calls.batches.length, 1);
  assert.equal(calls.batches[0].batch.length, 2);
});

test('insertLines: batches at the default size of 500', async () => {
  assert.equal(LINE_BATCH_SIZE, 500);
  const { client, calls } = fakeLineClient();
  const records = Array.from({ length: 1200 }, (_, i) => rec({ external_ref: `R${i}` }));
  const n = await insertLines(client, 'rep-1', records, LINES_OPTS);
  assert.equal(n, 1200);
  assert.deepEqual(
    calls.batches.map((b) => b.batch.length),
    [500, 500, 200]
  );
});

test('insertLines: honours a custom batchSize', async () => {
  const { client, calls } = fakeLineClient();
  const records = Array.from({ length: 10 }, (_, i) => rec({ external_ref: `R${i}` }));
  const n = await insertLines(client, 'rep-1', records, { ...LINES_OPTS, batchSize: 3 });
  assert.equal(n, 10);
  assert.deepEqual(
    calls.batches.map((b) => b.batch.length),
    [3, 3, 3, 1]
  );
});

test('insertLines: every row has booking_intent_id=null and status=unmatched', async () => {
  const { client, calls } = fakeLineClient();
  const records = Array.from({ length: 5 }, (_, i) => rec({ external_ref: `R${i}` }));
  await insertLines(client, 'rep-1', records, LINES_OPTS);
  const allRows = calls.batches.flatMap((b) => b.batch);
  assert.equal(allRows.length, 5);
  for (const row of allRows) {
    assert.equal(row.booking_intent_id, null);
    assert.equal(row.status, 'unmatched');
    assert.equal(row.report_id, 'rep-1');
    assert.equal(row.partner_slug, 'best-western-vernal');
  }
});

test('insertLines: empty records → 0 inserted, no DB call', async () => {
  const { client, calls } = fakeLineClient();
  const n = await insertLines(client, 'rep-1', [], LINES_OPTS);
  assert.equal(n, 0);
  assert.equal(calls.batches.length, 0);
});

test('insertLines: NEVER touches booking_intent or partner_report', async () => {
  const { client, calls } = fakeLineClient();
  await insertLines(client, 'rep-1', [rec(), rec()], { ...LINES_OPTS, batchSize: 1 });
  for (const t of calls.tables) assert.equal(t, 'partner_report_line');
  assert.ok(!calls.tables.includes('booking_intent'));
  assert.ok(!calls.tables.includes('partner_report'));
});

test('insertLines: aborts on a failing batch (no rollback — T14)', async () => {
  // Fail the 2nd batch; the 1st has already been sent (demonstrating no rollback yet).
  const { client, calls } = fakeLineClient((_batch, index) =>
    index === 1 ? { error: { message: 'constraint violation' } } : { error: null }
  );
  const records = Array.from({ length: 5 }, (_, i) => rec({ external_ref: `R${i}` }));
  await assert.rejects(
    () => insertLines(client, 'rep-1', records, { ...LINES_OPTS, batchSize: 2 }),
    /partner_report_line insert failed .*constraint violation/
  );
  // Batch 0 and batch 1 were attempted; batch 2 was never reached (aborted).
  assert.equal(calls.batches.length, 2);
});

test('insertLines: validates arguments before inserting', async () => {
  const good = Array.from({ length: 2 }, () => rec());
  await assert.rejects(() => insertLines(null, 'rep-1', good, LINES_OPTS), TypeError);
  await assert.rejects(() => insertLines({}, 'rep-1', good, LINES_OPTS), TypeError);
  await assert.rejects(() => insertLines(fakeLineClient().client, '', good, LINES_OPTS), TypeError);
  await assert.rejects(
    () => insertLines(fakeLineClient().client, 'rep-1', 'not-array', LINES_OPTS),
    TypeError
  );
  await assert.rejects(() => insertLines(fakeLineClient().client, 'rep-1', good, {}), TypeError); // no partner_slug
  await assert.rejects(
    () => insertLines(fakeLineClient().client, 'rep-1', good, { ...LINES_OPTS, batchSize: 0 }),
    TypeError
  );
});

// ── T14: rollback (deleteReport + persistReport) ─────────────────────────────
// Combined fake handling all three chains: header insert (→ select().single()), line
// batch insert (awaitable), and header delete (.delete().eq()). Each is configurable and
// every touched table + the call order are recorded.
function fakeReportClient({ headerResult, lineResultFor, deleteResult } = {}) {
  const calls = { tables: [], header: [], lineBatches: [], deletes: [], order: [] };
  const client = {
    from(table) {
      calls.tables.push(table);
      return {
        insert(payload) {
          if (table === 'partner_report') {
            calls.header.push(payload);
            calls.order.push('insert:header');
            return {
              select: () => ({
                single: async () => headerResult ?? { data: { id: 'rep-1' }, error: null },
              }),
            };
          }
          if (table === 'partner_report_line') {
            const index = calls.lineBatches.length;
            calls.lineBatches.push(payload);
            calls.order.push('insert:lines');
            return Promise.resolve((lineResultFor ?? (() => ({ error: null })))(payload, index));
          }
          throw new Error(`unexpected insert into ${table}`);
        },
        delete() {
          return {
            eq: (col, val) => {
              calls.deletes.push({ table, col, val });
              calls.order.push('delete:header');
              return Promise.resolve(deleteResult ?? { error: null });
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const HEADER_META = {
  partner_slug: 'best-western-vernal',
  period_start: '2026-06-01',
  period_end: '2026-06-30',
  raw_csv: 'Ref\nR1\n',
};

test('deleteReport: deletes the header row by id (partner_report only)', async () => {
  const { client, calls } = fakeReportClient();
  await deleteReport(client, 'rep-9');
  assert.deepEqual(calls.tables, ['partner_report']);
  assert.deepEqual(calls.deletes, [{ table: 'partner_report', col: 'id', val: 'rep-9' }]);
});

test('deleteReport: throws on a delete error and on bad args', async () => {
  const { client } = fakeReportClient({ deleteResult: { error: { message: 'boom' } } });
  await assert.rejects(() => deleteReport(client, 'rep-9'), /rollback delete failed.*boom/);
  await assert.rejects(() => deleteReport(null, 'rep-9'), TypeError);
  await assert.rejects(() => deleteReport(fakeReportClient().client, ''), TypeError);
});

test('persistReport: happy path inserts header + lines and does NOT roll back', async () => {
  const { client, calls } = fakeReportClient();
  const records = Array.from({ length: 3 }, (_, i) => rec({ external_ref: `R${i}` }));
  const result = await persistReport(client, HEADER_META, records);
  assert.deepEqual(result, { report_id: 'rep-1', lineCount: 3 });
  assert.equal(calls.deletes.length, 0); // no rollback
  assert.deepEqual(calls.order, ['insert:header', 'insert:lines']);
});

test('persistReport: stamps the header partner_slug onto every line', async () => {
  const { client, calls } = fakeReportClient();
  await persistReport(client, HEADER_META, [rec(), rec({ external_ref: 'R2' })]);
  for (const row of calls.lineBatches.flat()) {
    assert.equal(row.partner_slug, 'best-western-vernal');
    assert.equal(row.report_id, 'rep-1');
    assert.equal(row.booking_intent_id, null);
    assert.equal(row.status, 'unmatched');
  }
});

test('persistReport: line failure rolls back the header, then aborts', async () => {
  const { client, calls } = fakeReportClient({
    lineResultFor: (_b, i) =>
      i === 1 ? { error: { message: 'constraint violation' } } : { error: null },
  });
  const records = Array.from({ length: 5 }, (_, i) => rec({ external_ref: `R${i}` }));

  const err = await persistReport(client, HEADER_META, records, { batchSize: 2 }).then(
    () => null,
    (e) => e
  );
  assert.ok(err, 'expected persistReport to throw');
  assert.match(err.message, /constraint violation/); // original error surfaced
  assert.match(err.message, /rolled back report rep-1/); // rollback context
  assert.equal(err.rolledBack, true);
  assert.equal(err.cause?.message.includes('constraint violation'), true);

  // Exactly one header delete happened, after the failed line insert.
  assert.deepEqual(calls.deletes, [{ table: 'partner_report', col: 'id', val: 'rep-1' }]);
  assert.equal(calls.order.at(-1), 'delete:header');
});

test('persistReport: header failure throws with NO rollback and NO line inserts', async () => {
  const { client, calls } = fakeReportClient({
    headerResult: { data: null, error: { message: 'header exploded' } },
  });
  await assert.rejects(
    () => persistReport(client, HEADER_META, [rec()]),
    /partner_report insert failed/
  );
  assert.equal(calls.lineBatches.length, 0); // lines never attempted
  assert.equal(calls.deletes.length, 0); // nothing to roll back
});

test('persistReport: a FAILED rollback is surfaced loudly (manual cleanup)', async () => {
  const { client } = fakeReportClient({
    lineResultFor: () => ({ error: { message: 'line boom' } }),
    deleteResult: { error: { message: 'delete boom' } },
  });
  const err = await persistReport(client, HEADER_META, [rec()]).then(
    () => null,
    (e) => e
  );
  assert.ok(err);
  assert.match(err.message, /line boom/); // original
  assert.match(err.message, /ROLLBACK ALSO FAILED.*delete boom/); // rollback failure
  assert.match(err.message, /manual cleanup required/);
  assert.equal(err.rolledBack, false);
});

test('persistReport: never touches booking_intent', async () => {
  const { client, calls } = fakeReportClient({
    lineResultFor: () => ({ error: { message: 'x' } }), // force the rollback path too
  });
  await persistReport(client, HEADER_META, [rec()]).catch(() => {});
  assert.ok(!calls.tables.includes('booking_intent'));
  // Only the two report tables are ever addressed.
  for (const t of calls.tables) assert.ok(t === 'partner_report' || t === 'partner_report_line');
});

test('persistReport: validates client and records up front', async () => {
  await assert.rejects(() => persistReport(null, HEADER_META, []), TypeError);
  await assert.rejects(
    () => persistReport(fakeReportClient().client, HEADER_META, 'nope'),
    TypeError
  );
});
