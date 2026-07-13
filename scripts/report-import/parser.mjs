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
