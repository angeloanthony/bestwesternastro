// Partner import profiles — slug-keyed registry (M6 · T04).
//
// A PROFILE is pure declarative data: it tells the (partner-agnostic) transform in
// parser.mjs (T06) how one partner's CSV columns become canonical records (T03). The
// importer never contains partner logic — it resolves the profile for a `--partner` slug
// and normalises the incoming CSV through it. Adding a partner is adding a config object
// HERE; no core module (reader, transform, validate, dedup, persist) changes. That is the
// whole point of the profile system, and this file is the only place hotel/BW specifics live.
//
// Each partner config declares, as data:
//   * slug               — the partner registry key (`--partner <slug>`).
//   * acceptedHeaders    — the CSV header set the export is expected to carry.
//   * map                — canonical field → source header name (field mappings).
//   * parsers            — date, currency, and room-night (quantity) coercers.
//   * constants          — canonical fields set to a fixed value (e.g. currency), not a column.
//   * unitLabel          — the constant `unit_label` (what `quantity` counts).
//   * reservationStatus  — raw reservation-status → normalised status enum.
//   * cancellation       — which normalised statuses are refunds/cancellations, and how to
//                          normalise their revenue.
//   * encoding           — charset / BOM / delimiter expectations for the export.
//
// `defineProfile` compiles that config into the exact shape parser.mjs's transform consumes
// (`map`, `coerce`, `unitLabel`, `transform`) while retaining the descriptive fields for
// header validation, documentation, and future steps. Everything below the BW profile is
// generic machinery; nothing here is specific to any one partner except the `PROFILES`
// entries themselves.

import { CANONICAL_FIELDS } from './canonical.mjs';
import { REQUIRED_FIELDS } from './validate.mjs';

// ── Reusable, partner-agnostic coercers ──────────────────────────────────────
//
// Each factory returns a `(rawValue) => value` coercer for a canonical field. They are the
// building blocks a profile wires onto its mapped fields; they carry no partner assumptions,
// only the format knobs a config passes in. A value that is blank becomes null (validation
// treats it as missing); a value that is present but unparseable also becomes null rather
// than throwing — the importer aborts on validation, not on a single stray cell.

/**
 * Build a date parser that normalises a partner's date format to a canonical ISO
 * `YYYY-MM-DD` string. Already-ISO input passes through. Unparseable non-blank input is
 * returned verbatim so validation reports it as an invalid date (more useful than "missing").
 *
 * @param {Object} [opts]
 * @param {'YMD'|'MDY'|'DMY'} [opts.order='YMD'] Field order of a non-ISO date.
 * @returns {(raw: string|null) => string|null}
 */
export function makeDateParser({ order = 'YMD' } = {}) {
  const pad = (n) => String(n).padStart(2, '0');
  return (raw) => {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;

    // Already canonical ISO — pass through untouched.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const parts = s.split(/[/.\-]/).map((p) => p.trim());
    if (parts.length !== 3 || parts.some((p) => p === '' || !/^\d+$/.test(p))) {
      return s; // unparseable → hand the raw value to validation to flag as invalid_date
    }

    let year;
    let month;
    let day;
    if (order === 'MDY') [month, day, year] = parts;
    else if (order === 'DMY') [day, month, year] = parts;
    else [year, month, day] = parts; // YMD

    if (year.length === 2) year = `20${year}`; // 2-digit year → 2000s
    return `${year.padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  };
}

/**
 * Build a currency parser that normalises a partner's money format to an integer number of
 * cents. Strips currency symbols and thousands separators, honours a configurable decimal
 * separator, and treats a leading `-` or surrounding `(…)` as negative (a refund). Blank or
 * unparseable input becomes null.
 *
 * @param {Object} [opts]
 * @param {string[]} [opts.symbols=['$']] Currency symbols/prefixes to strip.
 * @param {string} [opts.thousandsSeparator=','] Grouping separator to remove.
 * @param {string} [opts.decimalSeparator='.'] Decimal separator to normalise to '.'.
 * @returns {(raw: string|null) => number|null}
 */
export function makeCurrencyParser({
  symbols = ['$'],
  thousandsSeparator = ',',
  decimalSeparator = '.',
} = {}) {
  return (raw) => {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (s === '') return null;

    let negative = false;
    if (/^\(.*\)$/.test(s)) {
      negative = true;
      s = s.slice(1, -1).trim();
    }
    for (const sym of symbols) s = s.split(sym).join('');
    s = s.replace(/\s+/g, '');
    if (s.startsWith('-')) {
      negative = true;
      s = s.slice(1);
    } else if (s.startsWith('+')) {
      s = s.slice(1);
    }
    if (thousandsSeparator) s = s.split(thousandsSeparator).join('');
    if (decimalSeparator !== '.') s = s.split(decimalSeparator).join('.');

    if (s === '' || !/^\d*(\.\d+)?$/.test(s) || s === '.') return null; // unparseable
    const value = Number.parseFloat(s);
    if (!Number.isFinite(value)) return null;
    const cents = Math.round(value * 100);
    return negative ? -cents : cents;
  };
}

/**
 * Build an integer parser for a count field (e.g. room-nights → `quantity`). Blank or
 * non-integer input becomes null; sign is preserved so validation can reject non-positive
 * counts. This is deliberately generic — "room-night" is just the BW label for a count.
 *
 * @returns {(raw: string|null) => number|null}
 */
export function makeIntegerParser() {
  return (raw) => {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '' || !/^[+-]?\d+$/.test(s)) return null;
    return Number.parseInt(s, 10);
  };
}

/**
 * Build a reservation-status mapper: raw partner status string → a normalised status enum
 * the profile understands (e.g. 'confirmed', 'cancelled', 'no_show', 'refunded'). Unknown or
 * blank values fall back to `fallback`.
 *
 * @param {Object} [opts]
 * @param {Object<string,string>} [opts.map={}] Raw status → normalised status.
 * @param {string|null} [opts.fallback=null] Value for unknown/blank input.
 * @param {boolean} [opts.caseInsensitive=true] Match raw values case-insensitively.
 * @returns {(raw: string|null) => string|null}
 */
export function makeStatusMapper({ map = {}, fallback = null, caseInsensitive = true } = {}) {
  const key = (v) => (caseInsensitive ? String(v).trim().toLowerCase() : String(v).trim());
  const table = new Map(Object.entries(map).map(([k, v]) => [key(k), v]));
  return (raw) => {
    if (raw == null || String(raw).trim() === '') return fallback;
    const k = key(raw);
    return table.has(k) ? table.get(k) : fallback;
  };
}

// ── Profile compiler ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} PartnerProfileConfig
 * @property {string}                    slug              Partner registry key.
 * @property {string[]}                  [acceptedHeaders] Expected CSV header set.
 * @property {Object<string,string>}     map               Canonical field → source header.
 * @property {Object<string,Function>}   [coerce]          Extra canonical field → coercer.
 * @property {Object}                    [parsers]         { date, currency, roomNights } coercers.
 * @property {Object<string,*>}          [constants]       Canonical field → fixed value.
 * @property {string}                    [unitLabel]       Constant `unit_label` value.
 * @property {Object}                    [reservationStatus] { header, map, fallback } status mapping.
 * @property {Object}                    [cancellation]    { refundStatuses[], negateRevenue } rules.
 * @property {Object}                    [encoding]        { charset, stripBom, delimiter }.
 */

/** Which canonical field each named parser feeds, unless the config maps it explicitly. */
const PARSER_FIELD = Object.freeze({
  date: ['service_start', 'service_end'],
  currency: ['revenue_cents'],
  roomNights: ['quantity'],
});

/**
 * Compile a declarative partner config into a profile the T06 transform consumes directly.
 * The returned object carries BOTH the transform-facing keys (`map`, `coerce`, `unitLabel`,
 * `transform`) and the descriptive config (`slug`, `acceptedHeaders`, `encoding`,
 * `reservationStatus`, `cancellation`) so later steps (header validation, docs) can read it.
 *
 * Every required canonical field must be covered by `map`, `constants`, or `unitLabel`;
 * a config that leaves one uncovered throws here (fail fast at registration, not at runtime).
 *
 * @param {PartnerProfileConfig} config
 * @returns {Readonly<Object>} A frozen profile.
 * @throws {TypeError} On a missing slug or an uncovered required canonical field.
 */
export function defineProfile(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('defineProfile requires a config object');
  }
  const { slug } = config;
  if (typeof slug !== 'string' || slug.trim() === '') {
    throw new TypeError('a partner profile requires a non-empty string slug');
  }

  const map = { ...(config.map ?? {}) };
  const constants = { ...(config.constants ?? {}) };
  const unitLabel = config.unitLabel ?? constants.unit_label ?? null;
  const parsers = config.parsers ?? {};

  // Wire the named parsers onto their canonical fields (unless the config overrode a field's
  // coercer explicitly). Only fields the profile actually maps get a coercer.
  const coerce = { ...(config.coerce ?? {}) };
  for (const [name, fields] of Object.entries(PARSER_FIELD)) {
    const parser = parsers[name];
    if (typeof parser !== 'function') continue;
    for (const field of fields) {
      if (field in map && !(field in coerce)) coerce[field] = parser;
    }
  }

  // Guard: a mapping must only target real canonical fields.
  for (const field of Object.keys(map)) {
    if (!CANONICAL_FIELDS.includes(field)) {
      throw new TypeError(`profile '${slug}' maps unknown canonical field '${field}'`);
    }
  }
  // Guard: every required canonical field must have a source (a mapped column, a constant,
  // or the unit_label constant). Misconfiguration fails loudly at registration time.
  for (const field of REQUIRED_FIELDS) {
    const covered =
      field in map || field in constants || (field === 'unit_label' && unitLabel != null);
    if (!covered) {
      throw new TypeError(
        `profile '${slug}' does not cover required canonical field '${field}' (add it to map, constants, or unitLabel)`
      );
    }
  }

  const transform = buildTransform({
    constants,
    reservationStatus: config.reservationStatus ?? null,
    cancellation: config.cancellation ?? null,
  });

  return Object.freeze({
    slug,
    acceptedHeaders: Object.freeze([...(config.acceptedHeaders ?? Object.values(map))]),
    encoding: Object.freeze({
      charset: 'utf-8',
      stripBom: true,
      delimiter: ',',
      ...(config.encoding ?? {}),
    }),
    reservationStatus: config.reservationStatus ?? null,
    cancellation: config.cancellation ?? null,
    constants: Object.freeze({ ...constants }),
    // Consumed by parser.mjs's transformToCanonical:
    map: Object.freeze({ ...map }),
    coerce: Object.freeze({ ...coerce }),
    unitLabel,
    transform,
  });
}

/**
 * Build the record-level `transform` hook the transform runs last per row. It (1) fills any
 * canonical field declared as a constant (e.g. currency) that the mapping did not populate,
 * and (2) applies the reservation-status + cancellation/refund normalisation. All of this is
 * driven by the config — a profile with no status header and no constants gets an effective
 * no-op, so a purely map-and-coerce partner is unaffected.
 *
 * @param {Object} args
 * @param {Object<string,*>} args.constants
 * @param {Object|null} args.reservationStatus
 * @param {Object|null} args.cancellation
 * @returns {(record: Object, ctx: Object) => Object}
 */
function buildTransform({ constants, reservationStatus, cancellation }) {
  const constantEntries = Object.entries(constants);
  const statusHeader = reservationStatus?.header ?? null;
  const statusMapper = statusHeader ? makeStatusMapper(reservationStatus) : null;
  const refundStatuses = new Set(cancellation?.refundStatuses ?? []);
  const negateRevenue = Boolean(cancellation?.negateRevenue);

  return (record, ctx) => {
    // (1) Constant canonical fields — only fill what the mapping left null.
    for (const [field, value] of constantEntries) {
      if (record[field] == null) record[field] = value;
    }

    // (2) Reservation status → refund/cancellation normalisation. A row is a refund if its
    // normalised status says so, or if its revenue already came through negative. When the
    // profile opts into `negateRevenue`, a positive revenue on a refund row is flipped so the
    // canonical value reflects money returned; otherwise the value is left exactly as parsed.
    if (statusMapper) {
      const status = statusMapper(ctx?.raw ? ctx.raw[statusHeader] : null);
      const isRefund =
        (status != null && refundStatuses.has(status)) ||
        (typeof record.revenue_cents === 'number' && record.revenue_cents < 0);
      if (
        isRefund &&
        negateRevenue &&
        typeof record.revenue_cents === 'number' &&
        record.revenue_cents > 0
      ) {
        record.revenue_cents = -record.revenue_cents;
      }
    }

    return record;
  };
}

// ── Partner registry ─────────────────────────────────────────────────────────
//
// Best Western Vernal — the pilot partner. The header names, date order, currency format,
// and encoding below track docs/M6_CSV_IMPORTER.md §2, which is PROVISIONAL (⛔): Best
// Western has not confirmed the exact export format, so this profile is re-checked and
// LOCKED in T17 once they do. The SHAPE, however, is final — locking the contract means
// editing the data in this object, never the machinery around it.

export const bestWesternVernal = defineProfile({
  slug: 'best-western-vernal',
  acceptedHeaders: [
    'Confirmation #',
    'Guest Name',
    'Rate / Promo',
    'Arrival',
    'Departure',
    'Nights',
    'Room Revenue',
  ],
  map: {
    external_ref: 'Confirmation #',
    customer_name: 'Guest Name',
    promo_code: 'Rate / Promo',
    service_start: 'Arrival',
    service_end: 'Departure',
    quantity: 'Nights',
    revenue_cents: 'Room Revenue',
  },
  parsers: {
    // Provisional per §2: BW dates assumed MM/DD/YYYY (ISO also accepted), USD "$1,299.50".
    date: makeDateParser({ order: 'MDY' }),
    currency: makeCurrencyParser({
      symbols: ['$', 'USD'],
      thousandsSeparator: ',',
      decimalSeparator: '.',
    }),
    roomNights: makeIntegerParser(),
  },
  // Currency is a constant (no column) and quantity counts room-nights.
  constants: { currency: 'USD' },
  unitLabel: 'room_nights',
  // §2's provisional contract carries no status column, so status mapping is defined for the
  // day BW adds one but is inert until `reservationStatus.header` names a real column. Refunds
  // in the pilot are recognised solely by a negative Room Revenue (validation warns on them).
  reservationStatus: {
    header: null,
    map: {
      Confirmed: 'confirmed',
      Cancelled: 'cancelled',
      Canceled: 'cancelled',
      'No Show': 'no_show',
      Refunded: 'refunded',
    },
    fallback: null,
  },
  cancellation: { refundStatuses: ['cancelled', 'no_show', 'refunded'], negateRevenue: false },
  encoding: { charset: 'utf-8', stripBom: true, delimiter: ',' },
});

/** The slug-keyed registry. A new partner is a new `defineProfile(...)` entry here. */
const PROFILES = new Map([[bestWesternVernal.slug, bestWesternVernal]]);

/**
 * Resolve a partner profile by registry slug. This is the importer's `resolveProfile`
 * dependency — an unknown or non-string slug returns null (the CLI reports it cleanly).
 *
 * @param {string} slug
 * @returns {Readonly<Object>|null}
 */
export function getProfile(slug) {
  if (typeof slug !== 'string') return null;
  return PROFILES.get(slug) ?? null;
}

/** List the registered partner slugs (useful for CLI help / diagnostics). */
export function registeredSlugs() {
  return [...PROFILES.keys()];
}
