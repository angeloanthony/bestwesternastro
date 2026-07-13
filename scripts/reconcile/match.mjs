// Reconciliation matching engine (M8).
//
// Pure, deterministic resolution of report lines against booking intents. No I/O. Given the
// unmatched lines and the matchable intents, it produces a PLAN: which line pairs with which
// intent (and by what tier/confidence), which lines are ambiguous, and what is left over.
//
// Two invariants, both enforced here and backed by the DB (migration 010's partial unique
// index on booking_intent_id):
//   * one line  → at most one intent
//   * one intent → at most one line
// A line that matches more than one still-available intent on a given tier is NEVER
// auto-matched — it is marked AMBIGUOUS for a human, because guessing would mis-attribute
// revenue. Weaker tiers are not consulted for an already-ambiguous line (they can only be
// blurrier). Determinism comes from a stable sort, so a re-run over the same inputs yields
// the same plan.

import { classify, lineRefTokens, TIER_ORDER, DEFAULT_ARRIVAL_WINDOW_DAYS } from './rules.mjs';

/** Stable line ordering: by external_ref then id, so results don't depend on input order. */
function byLineKey(a, b) {
  return String(a.external_ref ?? '').localeCompare(String(b.external_ref ?? '')) || String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

/** Stable intent ordering: oldest first (created_at) then id. */
function byIntentKey(a, b) {
  return String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

/**
 * @typedef {Object} Match
 * @property {Object} line   The report line.
 * @property {Object} intent The booking intent it attributes to.
 * @property {string} tier   Which MATCH_TIER resolved it.
 * @property {string} confidence 'high' | 'low'.
 */

/**
 * @typedef {Object} ReconcilePlan
 * @property {Match[]}  matches          One-to-one line↔intent pairings, safe to auto-apply.
 * @property {Object[]} ambiguous        { line, tier, candidateIntentIds } — left for review.
 * @property {Object[]} unmatchedLines   Lines with no candidate intent at any tier.
 * @property {Object[]} unmatchedIntents Intents no line claimed (candidates for aging → no_match).
 */

/**
 * Resolve lines against intents into a plan.
 *
 * @param {Object[]} lines   Unmatched partner_report_line rows.
 * @param {Object[]} intents Matchable booking_intent rows (status clicked/confirmed).
 * @param {Object} [opts]
 * @param {number} [opts.windowDays=DEFAULT_ARRIVAL_WINDOW_DAYS] Arrival tolerance for tiers 2/3.
 * @param {Object<string,string>} [opts.lastNameByIntentId] Optional member last name per intent id (enables tier 2).
 * @returns {ReconcilePlan}
 */
export function reconcile(lines, intents, opts = {}) {
  if (!Array.isArray(lines)) throw new TypeError('reconcile requires an array of lines');
  if (!Array.isArray(intents)) throw new TypeError('reconcile requires an array of intents');

  const windowDays = opts.windowDays ?? DEFAULT_ARRIVAL_WINDOW_DAYS;
  const lastNameByIntentId = opts.lastNameByIntentId ?? {};

  const lineList = [...lines].sort(byLineKey);
  const intentList = [...intents].sort(byIntentKey);

  // Precompute each line's ref tokens once (avoids re-scanning raw per intent per tier).
  const refTokensByLineId = new Map();
  for (const line of lineList) refTokensByLineId.set(line.id, lineRefTokens(line));

  const ctxFor = (line, intent) => ({
    windowDays,
    intentLastName: lastNameByIntentId[intent.id] ?? null,
    refTokens: refTokensByLineId.get(line.id),
  });

  const usedLine = new Set();
  const usedIntent = new Set();
  const matches = [];
  const ambiguous = [];

  for (const tier of TIER_ORDER) {
    for (const line of lineList) {
      if (usedLine.has(line.id)) continue;

      // Candidates: still-available intents whose STRONGEST tier with this line is exactly the
      // tier we're currently resolving. (classify returns the strongest applicable tier, so a
      // pair is only considered at its own tier — never double-counted across tiers.)
      const candidates = [];
      for (const intent of intentList) {
        if (usedIntent.has(intent.id)) continue;
        const c = classify(line, intent, ctxFor(line, intent));
        if (c && c.tier === tier) candidates.push({ intent, confidence: c.confidence });
      }

      if (candidates.length === 1) {
        const { intent, confidence } = candidates[0];
        matches.push({ line, intent, tier, confidence });
        usedLine.add(line.id);
        usedIntent.add(intent.id);
      } else if (candidates.length > 1) {
        // Strong signal, multiple claimants → unsafe to guess. Park for human review and take
        // the line out of contention for weaker tiers.
        ambiguous.push({ line, tier, candidateIntentIds: candidates.map((c) => c.intent.id) });
        usedLine.add(line.id);
      }
      // 0 candidates → the line falls through to the next (weaker) tier.
    }
  }

  const unmatchedLines = lineList.filter((l) => !usedLine.has(l.id));
  const unmatchedIntents = intentList.filter((i) => !usedIntent.has(i.id));

  return { matches, ambiguous, unmatchedLines, unmatchedIntents };
}
