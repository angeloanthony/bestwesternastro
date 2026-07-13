// Duplicate-detection helpers (M6 · T09).
//
// Pure, side-effect-free helpers for deciding whether an incoming CSV has already been
// imported. NO database access, NO file I/O, NO persistence — callers (the write path at
// T12–T15) fetch existing report rows and pass them in; these functions only compute and
// compare. The only dependency is node:crypto for hashing.
//
// The design stores the file hash INSIDE the report's existing `source_note` text (as a
// token) — no new schema columns are introduced (per the approved schema). Given the
// verbatim `raw_csv` we can also recompute a hash on demand, so an existing report's hash
// can come from either place; reportHash() handles both.

import { createHash } from 'node:crypto';

/**
 * SHA-256 of CSV content, hex-encoded. Deterministic: identical bytes → identical hash.
 * @param {string|Buffer} content Raw CSV bytes/text.
 * @returns {string} 64-char lowercase hex digest.
 * @throws {TypeError} If content is neither string nor Buffer.
 */
export function sha256Hex(content) {
  if (typeof content !== 'string' && !Buffer.isBuffer(content)) {
    throw new TypeError('sha256Hex expects a string or Buffer');
  }
  return createHash('sha256').update(content).digest('hex');
}

/**
 * The natural import key: what makes a report unique at the business level — one partner,
 * one reporting period. Two imports with the same natural key cover the same ground.
 * @param {{partner_slug?: string, period_start?: string, period_end?: string}} row
 * @returns {string} e.g. "best-western-vernal:2026-06-01:2026-06-30".
 */
export function naturalKey({ partner_slug, period_start, period_end } = {}) {
  return `${partner_slug ?? ''}:${period_start ?? ''}:${period_end ?? ''}`;
}

// ── source_note hash token ───────────────────────────────────────────────────
// The hash rides along in the free-text source_note as `sha256:<hex>` so no schema
// column is needed. It can be embedded among other note text and parsed back out.

/** Matches a hash token anywhere within a larger note string. */
export const HASH_TOKEN_RE = /sha256:([0-9a-f]{64})/i;

/**
 * Format a hash as a source_note token.
 * @param {string} hash 64-char hex sha256.
 * @returns {string} e.g. "sha256:abc…".
 * @throws {TypeError} If hash is not a 64-char hex string.
 */
export function formatHashToken(hash) {
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) {
    throw new TypeError('formatHashToken expects a 64-char hex sha256 string');
  }
  return `sha256:${hash.toLowerCase()}`;
}

/**
 * Extract a hash token from source_note text (or any string).
 * @param {string} text
 * @returns {string|null} lowercase hex hash, or null if none present.
 */
export function parseHashToken(text) {
  if (typeof text !== 'string') return null;
  const match = HASH_TOKEN_RE.exec(text);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Best-available hash for an existing report row. Prefers an explicit `hash`, then a token
 * parsed from `source_note`, then a fresh hash of the stored `raw_csv`.
 * @param {{hash?: string, source_note?: string, raw_csv?: string}} row
 * @returns {string|null}
 */
export function reportHash(row) {
  if (!row) return null;
  if (typeof row.hash === 'string' && /^[0-9a-f]{64}$/i.test(row.hash)) {
    return row.hash.toLowerCase();
  }
  const fromNote = parseHashToken(row.source_note);
  if (fromNote) return fromNote;
  if (typeof row.raw_csv === 'string') return sha256Hex(row.raw_csv);
  return null;
}

/**
 * True if two closed date ranges intersect. ISO `YYYY-MM-DD` strings compare correctly as
 * strings. Missing endpoints → no overlap (can't reason about an open range here).
 */
export function periodsOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/** Decision outcomes for an incoming import. */
export const DECISION = Object.freeze({
  ALLOW: 'allow',
  BLOCK_DUPLICATE: 'block-duplicate',
  WARN_OVERLAP: 'warn-overlap',
});

/**
 * @typedef {Object} ImportDecision
 * @property {string} decision One of DECISION.
 * @property {string} reason   Human-readable explanation.
 * @property {Array<{type: string, report: Object}>} conflicts Matching existing reports.
 */

/**
 * Decide whether an incoming file may be imported, given existing reports for inspection.
 * Pure: it accesses no database — the caller supplies `existingReports`.
 *
 * Precedence (strongest first):
 *   1. same-hash    → BLOCK_DUPLICATE  (identical bytes already imported)
 *   2. same-period  → WARN_OVERLAP     (same partner+period, different content → use --replace)
 *   3. overlap      → WARN_OVERLAP     (periods intersect but differ)
 *   otherwise       → ALLOW
 *
 * @param {{newHash: string, partner_slug: string, period_start: string, period_end: string}} incoming
 * @param {Array<Object>} [existingReports] Rows with partner_slug, period bounds, and one
 *   of hash / source_note / raw_csv.
 * @returns {ImportDecision}
 * @throws {TypeError} On malformed input.
 */
export function decideImport(incoming, existingReports = []) {
  if (!incoming || typeof incoming.newHash !== 'string' || !incoming.newHash) {
    throw new TypeError('decideImport requires incoming.newHash');
  }
  if (!Array.isArray(existingReports)) {
    throw new TypeError('decideImport expects existingReports to be an array');
  }

  const { newHash, partner_slug, period_start, period_end } = incoming;
  const newKey = naturalKey({ partner_slug, period_start, period_end });
  const conflicts = [];

  for (const report of existingReports) {
    if (!report || report.partner_slug !== partner_slug) continue; // different partner: irrelevant

    let type = null;
    if (reportHash(report) === newHash.toLowerCase()) {
      type = 'same-hash';
    } else if (naturalKey(report) === newKey) {
      type = 'same-period';
    } else if (periodsOverlap(period_start, period_end, report.period_start, report.period_end)) {
      type = 'overlap';
    }
    if (type) conflicts.push({ type, report });
  }

  if (conflicts.some((c) => c.type === 'same-hash')) {
    return {
      decision: DECISION.BLOCK_DUPLICATE,
      reason: 'identical file already imported (hash match)',
      conflicts,
    };
  }
  if (conflicts.some((c) => c.type === 'same-period')) {
    return {
      decision: DECISION.WARN_OVERLAP,
      reason:
        'a report for the same partner and period already exists with different content (use --replace to supersede)',
      conflicts,
    };
  }
  if (conflicts.some((c) => c.type === 'overlap')) {
    return {
      decision: DECISION.WARN_OVERLAP,
      reason: 'an existing report overlaps this period',
      conflicts,
    };
  }
  return { decision: DECISION.ALLOW, reason: 'no duplicate or overlap found', conflicts: [] };
}
