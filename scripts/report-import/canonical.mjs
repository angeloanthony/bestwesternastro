// Canonical line-record contract (M6 · T03).
//
// The single shape that flows through the importer: parser (T05a/T06) produces it,
// validation (T07/T08) checks it, persistence (T12/T13) writes it. Defining it once,
// here, keeps those steps from drifting apart.
//
// Field names mirror the `partner_report_line` columns exactly (see
// docs/M6_CSV_IMPORTER.md §3) and are deliberately GENERIC — `quantity` + `unit_label`,
// not `room_nights`; `service_start/end`, not `checkin/checkout`. A non-hotel partner is
// then just a new profile (T04), never a change here. Do not rename these to match any
// one partner's vocabulary.
//
// Pure data only — no CSV parsing, no coercion, no I/O, no database logic. Coercion
// (dates → ISO, currency → integer cents) is the profile's job at transform time (T06);
// this module just guarantees the key set and shape.

/**
 * @typedef {Object} CanonicalRecord
 * @property {string}      external_ref   Partner's unique row key (e.g. confirmation #). Required.
 * @property {string|null} customer_name  Guest name as reported (raw form, e.g. "Last, First").
 * @property {string|null} promo_code     Promo/rate code reported for the stay (attribution key).
 * @property {string|null} service_start  Service start as ISO date (YYYY-MM-DD); arrival for a stay.
 * @property {string|null} service_end    Service end as ISO date (YYYY-MM-DD); departure for a stay.
 * @property {number|null} quantity       Positive integer count of units (e.g. nights).
 * @property {string|null} unit_label     What `quantity` counts, e.g. 'room_nights'. Set by the profile.
 * @property {number|null} revenue_cents  Reported revenue as an integer number of cents.
 * @property {string|null} currency       ISO currency code, e.g. 'USD'.
 * @property {Object|null} raw            The original CSV row, retained verbatim for audit / re-run.
 */

/**
 * The canonical field names, in schema order. This ordered list is the authoritative
 * contract every other step references; tests assert exact parity against it.
 * @type {ReadonlyArray<string>}
 */
export const CANONICAL_FIELDS = Object.freeze([
  'external_ref',
  'customer_name',
  'promo_code',
  'service_start',
  'service_end',
  'quantity',
  'unit_label',
  'revenue_cents',
  'currency',
  'raw',
]);

/**
 * Build a canonical record with every field present. Missing fields default to `null`
 * so downstream steps can rely on the full key set existing. Only canonical keys are
 * copied from `values`; anything else is ignored (the original row belongs in `raw`).
 *
 * @param {Partial<CanonicalRecord>} [values] Known field values to seed the record with.
 * @returns {CanonicalRecord} A record containing exactly the canonical fields.
 */
export function createCanonicalRecord(values = {}) {
  const record = {};
  for (const field of CANONICAL_FIELDS) {
    record[field] = field in values ? values[field] : null;
  }
  return record;
}
