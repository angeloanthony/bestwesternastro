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
