// Confidence-based matching rules (M8 · reconciliation engine).
//
// Pure classification only: given ONE report line and ONE booking intent, decide whether —
// and how strongly — they attribute to the same stay. No I/O, no database, no mutation.
// The engine (match.mjs) calls classify() across the cross-product and resolves conflicts.
//
// The tiers encode the attribution keys from docs/PARTNER_REFERRAL_ARCHITECTURE.md §4,
// ordered here strongest → weakest by how safely they identify a UNIQUE click:
//   1. ref_code        — the per-click code; unique by construction. Strongest when present.
//   2. promo+arrival+name — promo code, arrival within a day, and the member's last name.
//   3. promo+arrival   — promo code and arrival within a day.
//   4. promo only      — promo code alone. Weak; only safe when exactly one candidate exists.
//
// promo_code is the load-bearing signal in practice (the guest says it at the desk and it
// lands on the folio/report); ref_code rarely survives the engine's funnel but is decisive
// when it does. Do not reorder without updating that doc.

/** Match tiers, strongest → weakest. The engine tries them in this order. */
export const MATCH_TIER = Object.freeze({
  REF_CODE: 'ref_code',
  PROMO_ARRIVAL_NAME: 'promo+arrival+name',
  PROMO_ARRIVAL: 'promo+arrival',
  PROMO_ONLY: 'promo',
});

/** The tier order the engine iterates (strongest first). */
export const TIER_ORDER = Object.freeze([
  MATCH_TIER.REF_CODE,
  MATCH_TIER.PROMO_ARRIVAL_NAME,
  MATCH_TIER.PROMO_ARRIVAL,
  MATCH_TIER.PROMO_ONLY,
]);

/** Confidence attached to a match. Only PROMO_ONLY is low-confidence. */
export const CONFIDENCE = Object.freeze({ HIGH: 'high', LOW: 'low' });

/** Arrival tolerance (± days) between the intent's check-in and the line's service_start. */
export const DEFAULT_ARRIVAL_WINDOW_DAYS = 1;

/** Normalize a code (promo/ref) for comparison: trim + uppercase; blank → null. */
export function normalizeCode(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed === '' ? null : trimmed;
}

/**
 * Extract a comparable last name from a reported guest name. Handles the common
 * "Last, First" form (token before the comma) and falls back to the final whitespace token
 * for "First Last". Lowercased and trimmed; blank → null. Purely for tier-2 corroboration.
 */
export function reportedLastName(customerName) {
  if (typeof customerName !== 'string') return null;
  const name = customerName.trim();
  if (name === '') return null;
  const beforeComma = name.includes(',') ? name.slice(0, name.indexOf(',')) : null;
  const base = beforeComma ?? name.split(/\s+/).at(-1) ?? '';
  const last = base.trim().toLowerCase();
  return last === '' ? null : last;
}

/** Parse an ISO YYYY-MM-DD date to a UTC epoch (ms), or null if unparseable. */
function isoToUtcMs(iso) {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

/** Whole-day distance between two ISO dates, or null if either is missing/invalid. */
export function dayDistance(isoA, isoB) {
  const a = isoToUtcMs(isoA);
  const b = isoToUtcMs(isoB);
  if (a === null || b === null) return null;
  return Math.round(Math.abs(a - b) / 86_400_000);
}

/** True when the intent's check-in falls within ±windowDays of the line's service_start. */
export function arrivalWithinWindow(intentCheckin, lineServiceStart, windowDays) {
  const d = dayDistance(intentCheckin, lineServiceStart);
  return d !== null && d <= windowDays;
}

/**
 * Collect the line's scannable string tokens (external_ref + every string value in `raw`),
 * uppercased, for opportunistic ref_code matching. The canonical line has no dedicated
 * ref_code column, so a ref code — if the partner echoes it — lives in the confirmation
 * field or a raw column. Returns a Set of normalized tokens.
 */
export function lineRefTokens(line) {
  const tokens = new Set();
  const add = (v) => {
    const n = normalizeCode(typeof v === 'number' ? String(v) : v);
    if (n) tokens.add(n);
  };
  add(line?.external_ref);
  const raw = line?.raw;
  if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw)) add(v);
  }
  return tokens;
}

/**
 * Classify one (line, intent) pair. Returns the strongest applicable tier + confidence, or
 * null when they cannot attribute to the same stay.
 *
 * @param {Object} line   A partner_report_line (canonical fields + raw).
 * @param {Object} intent A booking_intent row.
 * @param {Object} [ctx]
 * @param {number} [ctx.windowDays=DEFAULT_ARRIVAL_WINDOW_DAYS] Arrival tolerance.
 * @param {string|null} [ctx.intentLastName] Member last name for this intent (optional; enables tier 2).
 * @param {Set<string>} [ctx.refTokens] Precomputed line ref tokens (else derived from the line).
 * @returns {{tier: string, confidence: string}|null}
 */
export function classify(line, intent, ctx = {}) {
  const windowDays = ctx.windowDays ?? DEFAULT_ARRIVAL_WINDOW_DAYS;
  const refTokens = ctx.refTokens ?? lineRefTokens(line);

  // Tier 1 — ref_code: the intent's unique per-click code appears among the line's tokens.
  const intentRef = normalizeCode(intent?.ref_code);
  if (intentRef && refTokens.has(intentRef)) {
    return { tier: MATCH_TIER.REF_CODE, confidence: CONFIDENCE.HIGH };
  }

  // The remaining tiers all require the promo code to match.
  const linePromo = normalizeCode(line?.promo_code);
  const intentPromo = normalizeCode(intent?.promo_code);
  const promoMatch = linePromo !== null && linePromo === intentPromo;
  if (!promoMatch) return null;

  const arrivalMatch = arrivalWithinWindow(intent?.checkin, line?.service_start, windowDays);

  // Tier 2 — promo + arrival + member last name.
  if (arrivalMatch) {
    const intentLast =
      typeof ctx.intentLastName === 'string' ? ctx.intentLastName.toLowerCase() : null;
    const lineLast = reportedLastName(line?.customer_name);
    if (intentLast && lineLast && intentLast === lineLast) {
      return { tier: MATCH_TIER.PROMO_ARRIVAL_NAME, confidence: CONFIDENCE.HIGH };
    }
    // Tier 3 — promo + arrival.
    return { tier: MATCH_TIER.PROMO_ARRIVAL, confidence: CONFIDENCE.HIGH };
  }

  // Tier 4 — promo only (no arrival corroboration). Weak; the engine only accepts it when a
  // single candidate exists, else it is left ambiguous.
  return { tier: MATCH_TIER.PROMO_ONLY, confidence: CONFIDENCE.LOW };
}
