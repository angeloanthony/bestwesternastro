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

const HEADER_TABLE = 'partner_report';

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
