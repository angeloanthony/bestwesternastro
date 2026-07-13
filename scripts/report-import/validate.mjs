// Canonical-record validation (M6 · T07).
//
// Validates an array of CANONICAL records (the T03 shape produced by the T06 transform).
// It works purely on canonical values — it never sees CSV headers and never knows a
// partner's raw formats (those are coerced away upstream by the profile at T06). So this
// module is partner-agnostic: it enforces the canonical schema, nothing else.
//
// It collects EVERY violation (never stops at the first) and separates them by severity:
//   * errors   — fatal; the batch must not be imported while any exist.
//   * warnings — advisory; the batch may still import, but a human should look.
//
// Out of scope by design: no CSV/header validation, no partner-specific format checks,
// no persistence, no matching, no commission math, no file or network I/O.

/**
 * Canonical fields that must be present and valid on every record (missing → fatal).
 * @type {ReadonlyArray<string>}
 */
export const REQUIRED_FIELDS = Object.freeze([
  'external_ref',
  'service_start',
  'service_end',
  'quantity',
  'unit_label',
  'revenue_cents',
  'currency',
]);

/**
 * Canonical fields that are attribution-helpful but optional (missing → warning only).
 * @type {ReadonlyArray<string>}
 */
export const SOFT_FIELDS = Object.freeze(['customer_name', 'promo_code']);

/**
 * @typedef {Object} Issue
 * @property {number|null} row     Index into the records array (0-based); null if batch-level.
 * @property {string|null} field   Canonical field the issue concerns, or null.
 * @property {string}      code    Machine-readable code, e.g. 'missing_required'.
 * @property {string}      message Human-readable description.
 */

/**
 * @typedef {Object} Manifest
 * @property {boolean}   ok       True when there are zero fatal errors (warnings allowed).
 * @property {Issue[]}   errors   Fatal issues, row-ordered.
 * @property {Issue[]}   warnings Advisory issues, row-ordered.
 */

/** A value counts as "missing" if it is null/undefined or a blank/whitespace-only string. */
function isMissing(value) {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/** True only for a strict `YYYY-MM-DD` string that is also a real calendar date. */
function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/**
 * Validate a batch of canonical records.
 *
 * @param {Object[]} records Canonical records (see canonical.mjs). Not mutated.
 * @returns {Manifest}
 * @throws {TypeError} If `records` is not an array.
 */
export function validateRecords(records) {
  if (!Array.isArray(records)) {
    throw new TypeError('validateRecords expects an array of canonical records');
  }

  const errors = [];
  const warnings = [];
  const err = (row, field, code, message) => errors.push({ row, field, code, message });
  const warn = (row, field, code, message) => warnings.push({ row, field, code, message });

  records.forEach((record, row) => {
    const rec = record ?? {};

    // — Required fields present —
    for (const field of REQUIRED_FIELDS) {
      if (isMissing(rec[field])) {
        err(row, field, 'missing_required', `missing required field '${field}'`);
      }
    }

    // — Soft fields (attribution) present —
    for (const field of SOFT_FIELDS) {
      if (isMissing(rec[field])) {
        warn(row, field, 'missing_optional', `missing optional field '${field}'`);
      }
    }

    // — Dates valid (only when present; absence already reported above) —
    if (!isMissing(rec.service_start) && !isValidIsoDate(rec.service_start)) {
      err(row, 'service_start', 'invalid_date', `service_start is not a valid ISO date`);
    }
    if (!isMissing(rec.service_end) && !isValidIsoDate(rec.service_end)) {
      err(row, 'service_end', 'invalid_date', `service_end is not a valid ISO date`);
    }
    // — Dates ordered (only when both are valid) —
    if (
      isValidIsoDate(rec.service_start) &&
      isValidIsoDate(rec.service_end) &&
      rec.service_end < rec.service_start
    ) {
      err(row, 'service_end', 'end_before_start', `service_end is before service_start`);
    }

    // — Quantity: positive integer —
    if (!isMissing(rec.quantity) && !(Number.isInteger(rec.quantity) && rec.quantity > 0)) {
      err(row, 'quantity', 'invalid_quantity', `quantity must be a positive integer`);
    }

    // — Revenue: integer cents; negative is a warning, not fatal —
    if (!isMissing(rec.revenue_cents)) {
      if (!Number.isInteger(rec.revenue_cents)) {
        err(row, 'revenue_cents', 'invalid_revenue', `revenue_cents must be an integer`);
      } else if (rec.revenue_cents < 0) {
        warn(row, 'revenue_cents', 'negative_revenue', `revenue_cents is negative (refund?)`);
      }
    }
  });

  // — Duplicate external_ref within the batch (fatal) —
  const seen = new Map(); // ref value → first row index
  records.forEach((record, row) => {
    const ref = (record ?? {}).external_ref;
    if (isMissing(ref)) return;
    if (seen.has(ref)) {
      err(
        row,
        'external_ref',
        'duplicate_external_ref',
        `duplicate external_ref '${ref}' (first seen at row ${seen.get(ref)})`
      );
    } else {
      seen.set(ref, row);
    }
  });

  const byRow = (a, b) => (a.row ?? Infinity) - (b.row ?? Infinity);
  errors.sort(byRow);
  warnings.sort(byRow);

  return { ok: errors.length === 0, errors, warnings };
}
