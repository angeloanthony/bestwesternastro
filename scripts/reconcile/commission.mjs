// Commission calculator + stay-outcome derivation (M8).
//
// Pure money logic. Two rules that are non-negotiable per the milestone brief:
//   * NEVER invent a commission value. If the partner has no commission rate on record, the
//     commission is null (unknown), NOT zero and NOT a guess. The caller reports these.
//   * Commission is owed only on a COMPLETED stay. A cancelled/refunded line earns zero.
//
// Outcome derivation is deliberately conservative and documented: the canonical import line
// (M6) has no explicit status column, so a cancellation/refund is inferred from a
// non-positive revenue or night count (how refunds surface on a reservation report). When
// Best Western's real export format is confirmed (the provisional contract in
// docs/M6_CSV_IMPORTER.md §2), revisit deriveOutcome if it carries an explicit status.

/** Observed outcomes we persist onto booking_intent. */
export const OUTCOME = Object.freeze({ STAYED: 'stayed', CANCELLED: 'cancelled' });

/**
 * Infer whether a report line represents a completed stay or a cancellation/refund.
 * Non-positive revenue OR non-positive nights ⇒ cancelled/refunded; otherwise stayed.
 *
 * @param {Object} line A partner_report_line (canonical fields).
 * @returns {'stayed'|'cancelled'}
 */
export function deriveOutcome(line) {
  const revenue = line?.revenue_cents;
  const nights = line?.quantity;
  if (typeof revenue === 'number' && revenue <= 0) return OUTCOME.CANCELLED;
  if (typeof nights === 'number' && nights <= 0) return OUTCOME.CANCELLED;
  return OUTCOME.STAYED;
}

/**
 * Compute commission in integer cents.
 *   * outcome !== 'stayed'        → 0        (no commission owed on a non-stay)
 *   * commissionPercent is null   → null     (rate unknown — never invented; reported instead)
 *   * revenue not a finite number → null     (cannot compute against missing revenue)
 *   * otherwise                   → round(revenue_cents × percent ÷ 100)
 *
 * @param {number|null|undefined} revenueCents
 * @param {number|null|undefined} commissionPercent A percentage, e.g. 10 or 12.5.
 * @param {Object} [opts]
 * @param {'stayed'|'cancelled'} [opts.outcome='stayed']
 * @returns {number|null} Commission in cents, or null when it cannot/should not be computed.
 */
export function computeCommissionCents(revenueCents, commissionPercent, opts = {}) {
  const outcome = opts.outcome ?? OUTCOME.STAYED;
  if (outcome !== OUTCOME.STAYED) return 0;
  if (commissionPercent === null || commissionPercent === undefined) return null;
  const percent = Number(commissionPercent);
  if (!Number.isFinite(percent)) return null;
  if (!Number.isFinite(revenueCents)) return null;
  return Math.round((revenueCents * percent) / 100);
}
