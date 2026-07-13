// CSV reader — parser foundation (M6 · T05a).
//
// Turns raw CSV text into a GENERIC intermediate representation: the header row and
// every data row, each as a verbatim array of field strings. Nothing here knows about
// any partner, column name, or canonical field — it is pure RFC-4180 tokenising.
//
// Scope boundary (deliberate):
//   * NO header mapping — rows are string[][], never keyed by header name. Associating
//     headers with canonical fields is the profile's job at T06, driven by a partner
//     profile (T04). This module must stay partner-agnostic.
//   * NO validation — ragged rows are FLAGGED, not rejected. Deciding whether a mismatch
//     is fatal belongs to validation (T07/T08).
//   * NO canonical records, NO persistence, NO I/O beyond receiving the text string.
//
// RFC-4180 coverage: quoted fields, embedded commas, embedded newlines (LF or CRLF),
// escaped quotes (""), CRLF / LF / lone-CR record terminators, and a leading UTF-8 BOM.
//
// This module also hosts the profile-driven transform (T06). The transform turns the
// generic CSV grid above into canonical records (T03) using a partner PROFILE (T04) —
// but the transform itself contains ZERO partner-specific logic. See transformToCanonical.

import { createCanonicalRecord } from './canonical.mjs';

/**
 * @typedef {Object} RaggedRow
 * @property {number} row     Index into `rows` of the offending data row (0-based).
 * @property {number} columns Number of fields that row actually had.
 */

/**
 * @typedef {Object} CsvDocument
 * @property {string[]}     headers     The first record, verbatim (field strings, in order).
 * @property {string[][]}   rows        Every subsequent record as a verbatim array of fields.
 * @property {number}       columnCount Field count of the header row — the expected width.
 * @property {RaggedRow[]}  ragged      Data rows whose field count differs from `columnCount`.
 */

const BOM = '﻿';

/**
 * Tokenise CSV text into an array of records (each a string[] of fields), following
 * RFC-4180. Blank lines (a record that is a single empty field) are skipped — a trailing
 * newline or stray blank line does not become a spurious empty record.
 *
 * @param {string} text CSV source with the BOM already stripped.
 * @returns {string[][]} Records in file order.
 */
function tokenize(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  // Tracks whether the current (possibly empty) field/record has begun, so we can tell a
  // real empty trailing field from "nothing pending after a terminator".
  let pending = false;

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    // Skip blank lines: a lone empty field is not a data row.
    if (!(record.length === 1 && record[0] === '')) {
      records.push(record);
    }
    record = [];
    pending = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += c; // literal — including embedded commas and newlines
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      pending = true;
    } else if (c === ',') {
      endField();
      pending = true;
    } else if (c === '\n') {
      endRecord();
    } else if (c === '\r') {
      endRecord();
      if (text[i + 1] === '\n') i++; // consume the LF of a CRLF pair
    } else {
      field += c;
      pending = true;
    }
  }

  // Flush a final record that was not terminated by a trailing newline.
  if (pending || field !== '' || record.length > 0) {
    endRecord();
  }

  return records;
}

/**
 * Read CSV text into the generic intermediate representation. Strips a leading BOM,
 * parses per RFC-4180, and reports (does not reject) rows whose field count differs from
 * the header row.
 *
 * @param {string} text Raw CSV file contents.
 * @returns {CsvDocument}
 * @throws {TypeError} If `text` is not a string.
 */
export function readCsv(text) {
  if (typeof text !== 'string') {
    throw new TypeError(`readCsv expects a string, received ${typeof text}`);
  }

  const stripped = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const records = tokenize(stripped);

  if (records.length === 0) {
    return { headers: [], rows: [], columnCount: 0, ragged: [] };
  }

  const [headers, ...rows] = records;
  const columnCount = headers.length;
  const ragged = [];
  rows.forEach((cells, row) => {
    if (cells.length !== columnCount) {
      ragged.push({ row, columns: cells.length });
    }
  });

  return { headers, rows, columnCount, ragged };
}

// ── Profile-driven transform (T06) ───────────────────────────────────────────
//
// A PROFILE (built per partner at T04) declares — declaratively, as data — how a
// partner's columns become canonical fields. The transform below reads only from the
// profile; it hard-codes nothing about any partner, so swapping the mock profile in the
// tests for the real Best Western profile requires NO change here.
//
// Profile shape the transform consumes (all optional except as noted):
//   {
//     map:       { <canonicalField>: '<source header>' },  // which column feeds each field
//     coerce:    { <canonicalField>: (rawValue, ctx) => value },  // per-field coercion
//     unitLabel: 'room_nights',                            // constant unit_label for every row
//     transform: (record, ctx) => record,                  // optional record-level hook
//   }
// A field absent from `map` (and not `unit_label`/`raw`) keeps the factory default (null).

/**
 * @typedef {Object} PartnerProfile
 * @property {Object<string,string>}   [map]       Canonical field → source header name.
 * @property {Object<string,Function>} [coerce]    Canonical field → (rawValue, ctx) => value.
 * @property {string}                  [unitLabel] Constant value for the `unit_label` field.
 * @property {Function}                [transform] Optional (record, ctx) => record hook.
 */

/**
 * Zip a parsed row's cells against the headers into a plain object — the "original row"
 * kept verbatim on `record.raw`. Missing cells become null; cells beyond the header count
 * are left out (raggedness is reported by readCsv and judged by validation, not here).
 *
 * @param {string[]} headers
 * @param {string[]} cells
 * @returns {Object<string,string|null>}
 */
function zipRow(headers, cells) {
  const raw = {};
  for (let i = 0; i < headers.length; i++) {
    raw[headers[i]] = i < cells.length ? cells[i] : null;
  }
  return raw;
}

/**
 * Transform one parsed row into a canonical record using the profile. Pure — no I/O.
 *
 * @param {string[]} cells
 * @param {string[]} headers
 * @param {number} rowIndex
 * @param {PartnerProfile} profile
 * @param {() => Object} createRecord Canonical record factory (injected).
 * @returns {Object} A canonical record.
 */
function transformRow(cells, headers, rowIndex, profile, createRecord) {
  const raw = zipRow(headers, cells);
  const record = createRecord(); // full canonical key set, null defaults
  const ctx = { headers, cells, raw, rowIndex };

  for (const field of Object.keys(record)) {
    if (field === 'raw') {
      record.raw = raw;
      continue;
    }

    const header = profile.map ? profile.map[field] : undefined;
    if (header !== undefined) {
      const rawValue = raw[header] ?? null;
      const coercer = profile.coerce ? profile.coerce[field] : undefined;
      record[field] = coercer ? coercer(rawValue, { ...ctx, field, header }) : rawValue;
    } else if (field === 'unit_label' && profile.unitLabel != null) {
      record[field] = profile.unitLabel; // constant, not sourced from a column
    }
    // otherwise: leave the factory default (null)
  }

  return typeof profile.transform === 'function' ? profile.transform(record, ctx) : record;
}

/**
 * Apply a partner profile to parsed CSV output, producing canonical records. Every piece
 * of partner-specific behaviour (which column maps where, how to coerce, the unit label,
 * any record-level fixup) comes from `profile`; this function is partner-agnostic.
 *
 * @param {CsvDocument} csvDoc Output of {@link readCsv} (`{ headers, rows, ... }`).
 * @param {PartnerProfile} profile Partner profile (mock in tests, real BW profile at T04).
 * @param {() => Object} [createRecord] Canonical record factory; defaults to the real one.
 * @returns {Object[]} Canonical records, one per data row, each with `raw` retained.
 * @throws {TypeError} On malformed inputs.
 */
export function transformToCanonical(csvDoc, profile, createRecord = createCanonicalRecord) {
  if (!csvDoc || !Array.isArray(csvDoc.headers) || !Array.isArray(csvDoc.rows)) {
    throw new TypeError('transformToCanonical expects parsed CSV output { headers, rows }');
  }
  if (!profile || typeof profile !== 'object') {
    throw new TypeError('transformToCanonical requires a profile object');
  }
  if (typeof createRecord !== 'function') {
    throw new TypeError('transformToCanonical requires a canonical record factory function');
  }

  const { headers, rows } = csvDoc;
  return rows.map((cells, rowIndex) =>
    transformRow(cells, headers, rowIndex, profile, createRecord)
  );
}

/**
 * Convenience: read + transform in one call. Composes {@link readCsv} and
 * {@link transformToCanonical} with the default factory. Does not read files — `text` is
 * the already-loaded CSV string, supplied by the caller.
 *
 * @param {string} text Raw CSV contents.
 * @param {PartnerProfile} profile
 * @returns {Object[]} Canonical records.
 */
export function parse(text, profile) {
  return transformToCanonical(readCsv(text), profile);
}
