// Persistence — report header insert (M6 · T12).
//
// Writes exactly one `partner_report` header row via a service-role Supabase client. This
// is the ONLY table this task touches — `partner_report_line` is inserted separately at
// T13. No duplicate detection, no --replace, no matching, no commission logic here.
//
// Not fail-open (unlike the /go redirect path): this is staff tooling that must abort on
// any error rather than silently continue. The row-builder is pure and independently
// testable; the insert takes an INJECTED client so tests need no live database.

import { createClient } from '@supabase/supabase-js';

import { CANONICAL_FIELDS } from './canonical.mjs';

const HEADER_TABLE = 'partner_report';
const LINE_TABLE = 'partner_report_line';

/** Default rows per insert batch. */
export const LINE_BATCH_SIZE = 500;

// The only columns accepted from caller metadata. `received_at` is intentionally absent —
// the database defaults it to now(). Anything not in this list is dropped, so unrelated
// keys (e.g. line data, commission fields) can never leak into the header row.
const HEADER_FIELDS = Object.freeze([
  'partner_slug',
  'period_start',
  'period_end',
  'source_note',
  'raw_csv',
  'reconciled_by',
]);

/**
 * Build the header row from canonical import metadata. Pure: whitelists known fields and
 * validates the two that are load-bearing. No I/O.
 *
 * @param {Object} meta
 * @param {string} meta.partner_slug   Required — partner registry slug.
 * @param {string} meta.raw_csv        Required — the verbatim uploaded CSV (stored so a
 *                                      future matcher can re-run against exact bytes).
 * @param {string} [meta.period_start] ISO date.
 * @param {string} [meta.period_end]   ISO date.
 * @param {string} [meta.source_note]  Free text; carries the sha256 hash token + warnings.
 * @param {string} [meta.reconciled_by] Operator name.
 * @returns {Object} A row containing only whitelisted, defined fields.
 * @throws {TypeError} If required metadata is missing/invalid.
 */
export function buildHeaderRow(meta) {
  if (!meta || typeof meta !== 'object') {
    throw new TypeError('insertReport requires an import metadata object');
  }
  if (typeof meta.partner_slug !== 'string' || meta.partner_slug.trim() === '') {
    throw new TypeError('insertReport requires meta.partner_slug');
  }
  if (typeof meta.raw_csv !== 'string' || meta.raw_csv.length === 0) {
    throw new TypeError('insertReport requires meta.raw_csv (the verbatim upload)');
  }

  const row = {};
  for (const field of HEADER_FIELDS) {
    if (meta[field] !== undefined) row[field] = meta[field];
  }
  return row;
}

/**
 * Insert exactly one partner_report header row and return its id.
 *
 * @param {Object} client A service-role Supabase client (injected).
 * @param {Object} meta   Canonical import metadata (see buildHeaderRow).
 * @returns {Promise<string>} The new report's id.
 * @throws {TypeError} If the client or metadata is invalid.
 * @throws {Error} If the insert fails or returns no id (aborts — not fail-open).
 */
export async function insertReport(client, meta) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('insertReport requires a Supabase client');
  }
  const row = buildHeaderRow(meta);

  const { data, error } = await client.from(HEADER_TABLE).insert(row).select('id').single();

  if (error) {
    const span = `${row.period_start ?? '?'}..${row.period_end ?? '?'}`;
    throw new Error(
      `partner_report insert failed for '${row.partner_slug}' (${span}): ${error.message}`
    );
  }
  if (!data || !data.id) {
    throw new Error('partner_report insert returned no id');
  }
  return data.id;
}

/**
 * Build one partner_report_line row from a canonical record. Pure. Every row carries the
 * fixed columns (report_id, partner_slug, booking_intent_id=NULL, status='unmatched') plus
 * the canonical fields (external_ref … currency, and the `raw` jsonb), mapped 1:1 by name.
 * booking_intent_id is always NULL here — linking a line to an outbound click is the
 * matcher's job (a later milestone), never this insert.
 *
 * @param {string} report_id
 * @param {string} partner_slug
 * @param {Object} record Canonical record (see canonical.mjs).
 * @returns {Object} A row ready for insert.
 */
export function buildLineRow(report_id, partner_slug, record) {
  const row = {
    report_id,
    partner_slug,
    booking_intent_id: null,
    status: 'unmatched',
  };
  for (const field of CANONICAL_FIELDS) {
    row[field] = record?.[field] ?? null;
  }
  return row;
}

/**
 * Insert canonical records as partner_report_line rows, in batches. Does NOT match,
 * compute commission, update booking_intent, dedup, or roll back on failure (T14 adds
 * rollback). Not fail-open — aborts on the first failing batch.
 *
 * @param {Object} client A service-role Supabase client (injected).
 * @param {string} report_id The parent partner_report id.
 * @param {Object[]} records Canonical records.
 * @param {Object} [options]
 * @param {string} options.partner_slug Report-level partner slug stamped on every line.
 * @param {number} [options.batchSize=LINE_BATCH_SIZE] Rows per insert.
 * @returns {Promise<number>} Total rows inserted.
 * @throws {TypeError} On invalid client / report_id / records / partner_slug / batchSize.
 * @throws {Error} If any batch insert fails (aborts; earlier batches are NOT rolled back).
 */
export async function insertLines(client, report_id, records, options = {}) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('insertLines requires a Supabase client');
  }
  if (typeof report_id !== 'string' || report_id === '') {
    throw new TypeError('insertLines requires a report_id string');
  }
  if (!Array.isArray(records)) {
    throw new TypeError('insertLines requires an array of canonical records');
  }
  const { partner_slug, batchSize = LINE_BATCH_SIZE } = options;
  if (typeof partner_slug !== 'string' || partner_slug.trim() === '') {
    throw new TypeError('insertLines requires options.partner_slug');
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new TypeError('insertLines batchSize must be a positive integer');
  }

  const rows = records.map((record) => buildLineRow(report_id, partner_slug, record));

  let inserted = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const { error } = await client.from(LINE_TABLE).insert(batch);
    if (error) {
      throw new Error(
        `partner_report_line insert failed (batch at row ${start}, ${batch.length} rows) ` +
          `for report ${report_id}: ${error.message}`
      );
    }
    inserted += batch.length;
  }
  return inserted;
}

/**
 * Delete a partner_report header by id — the rollback primitive. Its partner_report_line
 * children are removed automatically by the FK's ON DELETE CASCADE (migration 009), so this
 * single delete undoes a whole import. Touches only partner_report.
 *
 * @param {Object} client A service-role Supabase client (injected).
 * @param {string} report_id
 * @returns {Promise<void>}
 * @throws {TypeError} On invalid client / report_id.
 * @throws {Error} If the delete fails.
 */
export async function deleteReport(client, report_id) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('deleteReport requires a Supabase client');
  }
  if (typeof report_id !== 'string' || report_id === '') {
    throw new TypeError('deleteReport requires a report_id string');
  }
  const { error } = await client.from(HEADER_TABLE).delete().eq('id', report_id);
  if (error) {
    throw new Error(
      `partner_report rollback delete failed for report ${report_id}: ${error.message}`
    );
  }
}

/**
 * Atomically persist a report: insert the header, then its lines. If the line insert fails
 * after the header exists, compensate by deleting the header (cascade removes any lines
 * already inserted), then abort by re-throwing the original error with rollback context.
 *
 * This is the atomic write unit; wiring it to the read path / dedup / --replace is T15.
 * partner_slug for the lines is taken from the header metadata (single source of truth).
 *
 * @param {Object} client A service-role Supabase client (injected).
 * @param {Object} meta   Header metadata (see buildHeaderRow); must include partner_slug.
 * @param {Object[]} records Canonical records for the lines.
 * @param {Object} [options]
 * @param {number} [options.batchSize] Rows per line batch.
 * @returns {Promise<{report_id: string, lineCount: number}>}
 * @throws {TypeError} On invalid client / records.
 * @throws {Error} If the header insert fails (nothing to roll back), or if the line insert
 *   fails (header is rolled back first; the thrown error carries rollback context and the
 *   original error on `.cause`).
 */
export async function persistReport(client, meta, records, options = {}) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('persistReport requires a Supabase client');
  }
  if (!Array.isArray(records)) {
    throw new TypeError('persistReport requires an array of canonical records');
  }

  // Header first. If this throws, nothing was created — no rollback needed.
  const report_id = await insertReport(client, meta);

  try {
    const lineCount = await insertLines(client, report_id, records, {
      partner_slug: meta.partner_slug,
      batchSize: options.batchSize,
    });
    return { report_id, lineCount };
  } catch (lineError) {
    // Compensating rollback: delete the header; ON DELETE CASCADE clears any lines.
    let rollbackError = null;
    try {
      await deleteReport(client, report_id);
    } catch (e) {
      rollbackError = e;
    }

    const context = rollbackError
      ? ` — ROLLBACK ALSO FAILED for report ${report_id}: ${rollbackError.message} ` +
        `(manual cleanup required)`
      : ` — rolled back report ${report_id} (header + cascaded lines deleted)`;

    const err = new Error(`${lineError.message}${context}`);
    err.cause = lineError;
    err.report_id = report_id;
    err.rolledBack = rollbackError === null;
    throw err;
  }
}

/**
 * Build a service-role Supabase client from the environment. Used by the CLI entry point
 * (not by unit tests, which inject a client). The service-role key bypasses RLS and is a
 * server secret — never expose it to the browser build.
 *
 * @param {Object} [env=process.env]
 * @returns {Object} A configured Supabase client.
 * @throws {Error} If the required environment variables are missing.
 */
export function createServiceClient(env = process.env) {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing credentials. partner_report is service_role-only; set ' +
        'PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service-role key is a ' +
        'server secret — never put it in the site build or a browser.'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
