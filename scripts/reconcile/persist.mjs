// Reconciliation persistence (M8).
//
// Service-role reads + writes for the matcher. Like the importer's persist.mjs this is NOT
// fail-open: staff tooling aborts on any error rather than silently continuing. The pure
// row-builder (buildIntentUpdate) is separately testable; every DB function takes an INJECTED
// client so tests need no live database.
//
// Writes are guarded by the source status ('unmatched' lines; 'clicked'/'confirmed' intents)
// so the whole run is IDEMPOTENT and re-runnable: a second run finds nothing to do, and a
// partial run (should a single row fail) is resumed by simply running again. Combined with
// migration 010's unique index on booking_intent_id, an intent can never be double-matched.

import { createClient } from '@supabase/supabase-js';

import { deriveOutcome, computeCommissionCents } from './commission.mjs';

const LINE_TABLE = 'partner_report_line';
const INTENT_TABLE = 'booking_intent';
const PARTNER_TABLE = 'partner';

/** Intent statuses the matcher is allowed to advance FROM. */
export const MATCHABLE_INTENT_STATUSES = Object.freeze(['clicked', 'confirmed']);

/** Columns pulled for matching (keep it lean; guest PII stays server-side regardless). */
const LINE_COLUMNS =
  'id, partner_slug, booking_intent_id, status, external_ref, customer_name, promo_code, ' +
  'service_start, service_end, quantity, unit_label, revenue_cents, currency, raw';
const INTENT_COLUMNS =
  'id, partner_slug, ref_code, promo_code, checkin, checkout, party_size, status, user_id, created_at';

/**
 * Build the booking_intent update for one match. Pure. Fills the reconciliation columns
 * booking_intent already has (006); commission may be null (rate unknown) or 0 (non-stay).
 *
 * @param {import('./match.mjs').Match} match
 * @param {Object} opts
 * @param {number|null} opts.commissionPercent Partner rate, or null if none on record.
 * @param {string} opts.now ISO timestamp to stamp matched_at (injected for determinism).
 * @returns {{outcome: string, commission_cents: number|null, update: Object}}
 */
export function buildIntentUpdate(match, opts) {
  const { commissionPercent, now } = opts;
  const line = match.line;
  const outcome = deriveOutcome(line);
  const commission_cents = computeCommissionCents(line.revenue_cents, commissionPercent, { outcome });
  const update = {
    status: outcome,
    matched_at: now,
    confirmation_number: line.external_ref ?? null,
    room_nights: line.quantity ?? null,
    revenue_cents: line.revenue_cents ?? null,
    commission_cents,
    notes: `reconciled: ${match.tier} (${match.confidence})`,
  };
  return { outcome, commission_cents, update };
}

/**
 * Fetch the unmatched report lines for a partner (optionally bounded by service_start).
 * @param {Object} client Service-role Supabase client.
 * @param {Object} args { partner_slug, period_start?, period_end? }
 * @returns {Promise<Object[]>}
 */
export async function fetchUnmatchedLines(client, { partner_slug, period_start, period_end } = {}) {
  assertClient(client, 'fetchUnmatchedLines');
  assertSlug(partner_slug, 'fetchUnmatchedLines');
  let query = client
    .from(LINE_TABLE)
    .select(LINE_COLUMNS)
    .eq('partner_slug', partner_slug)
    .eq('status', 'unmatched');
  if (period_start) query = query.gte('service_start', period_start);
  if (period_end) query = query.lte('service_start', period_end);
  const { data, error } = await query;
  if (error) throw new Error(`fetch unmatched lines failed for '${partner_slug}': ${error.message}`);
  return data ?? [];
}

/**
 * Fetch the matchable booking intents for a partner (status clicked/confirmed).
 * @returns {Promise<Object[]>}
 */
export async function fetchMatchableIntents(client, { partner_slug } = {}) {
  assertClient(client, 'fetchMatchableIntents');
  assertSlug(partner_slug, 'fetchMatchableIntents');
  const { data, error } = await client
    .from(INTENT_TABLE)
    .select(INTENT_COLUMNS)
    .eq('partner_slug', partner_slug)
    .in('status', MATCHABLE_INTENT_STATUSES);
  if (error) throw new Error(`fetch matchable intents failed for '${partner_slug}': ${error.message}`);
  return data ?? [];
}

/**
 * Fetch a partner's commission rate. Returns the numeric percent, or null when the partner
 * row is absent or the rate is unset — the matcher then leaves commission null and reports it.
 * @returns {Promise<number|null>}
 */
export async function fetchCommissionPercent(client, partner_slug) {
  assertClient(client, 'fetchCommissionPercent');
  assertSlug(partner_slug, 'fetchCommissionPercent');
  const { data, error } = await client
    .from(PARTNER_TABLE)
    .select('commission_percent')
    .eq('slug', partner_slug)
    .maybeSingle();
  if (error) throw new Error(`fetch commission rate failed for '${partner_slug}': ${error.message}`);
  const pct = data?.commission_percent;
  return pct === null || pct === undefined ? null : Number(pct);
}

/**
 * Apply a reconciliation plan. For each match: update the intent (guarded by its matchable
 * status) then link the line (guarded by status='unmatched'). Ambiguous lines are flagged
 * 'ambiguous'. With `dryRun`, computes and returns the same result WITHOUT any write.
 *
 * @param {Object} client Service-role client.
 * @param {import('./match.mjs').ReconcilePlan} plan
 * @param {Object} opts
 * @param {number|null} opts.commissionPercent
 * @param {string} opts.now ISO timestamp for matched_at.
 * @param {boolean} [opts.dryRun=false]
 * @returns {Promise<{applied: Array, ambiguousFlagged: number, stayed: number, cancelled: number,
 *   roomNights: number, revenueCents: number, commissionCents: number, commissionNullCount: number}>}
 */
export async function applyReconciliation(client, plan, opts) {
  if (!opts || typeof opts !== 'object') throw new TypeError('applyReconciliation requires opts');
  const { commissionPercent, now, dryRun = false } = opts;
  if (typeof now !== 'string' || now === '') {
    throw new TypeError('applyReconciliation requires opts.now (ISO timestamp)');
  }
  if (!dryRun) assertClient(client, 'applyReconciliation');

  const applied = [];
  const totals = {
    ambiguousFlagged: 0,
    stayed: 0,
    cancelled: 0,
    roomNights: 0,
    revenueCents: 0,
    commissionCents: 0,
    commissionNullCount: 0,
  };

  for (const match of plan.matches) {
    const { outcome, commission_cents, update } = buildIntentUpdate(match, { commissionPercent, now });

    if (!dryRun) {
      const { error: intentErr } = await client
        .from(INTENT_TABLE)
        .update(update)
        .eq('id', match.intent.id)
        .in('status', MATCHABLE_INTENT_STATUSES);
      if (intentErr) {
        throw new Error(`booking_intent update failed for ${match.intent.id}: ${intentErr.message}`);
      }
      const { error: lineErr } = await client
        .from(LINE_TABLE)
        .update({ booking_intent_id: match.intent.id, status: 'matched' })
        .eq('id', match.line.id)
        .eq('status', 'unmatched');
      if (lineErr) {
        throw new Error(`partner_report_line link failed for ${match.line.id}: ${lineErr.message}`);
      }
    }

    applied.push({
      line_id: match.line.id,
      intent_id: match.intent.id,
      tier: match.tier,
      confidence: match.confidence,
      outcome,
      commission_cents,
    });

    if (outcome === 'stayed') {
      totals.stayed += 1;
      totals.roomNights += Number.isFinite(match.line.quantity) ? match.line.quantity : 0;
      totals.revenueCents += Number.isFinite(match.line.revenue_cents) ? match.line.revenue_cents : 0;
      if (commission_cents === null) totals.commissionNullCount += 1;
      else totals.commissionCents += commission_cents;
    } else {
      totals.cancelled += 1;
    }
  }

  for (const item of plan.ambiguous) {
    if (!dryRun) {
      const { error } = await client
        .from(LINE_TABLE)
        .update({ status: 'ambiguous' })
        .eq('id', item.line.id)
        .eq('status', 'unmatched');
      if (error) {
        throw new Error(`partner_report_line ambiguous-flag failed for ${item.line.id}: ${error.message}`);
      }
    }
    totals.ambiguousFlagged += 1;
  }

  return { applied, ...totals };
}

/**
 * Age unmatched intents older than a cutoff to 'no_match'. Separate from matching so it can
 * be run (or not) independently; guarded by status so it only ever touches still-open clicks.
 *
 * @param {Object} client
 * @param {Object} opts { partner_slug, cutoffIso, dryRun? }
 * @returns {Promise<number>} Count aged (for dryRun, the count that WOULD be aged).
 */
export async function ageUnmatchedIntents(client, { partner_slug, cutoffIso, dryRun = false } = {}) {
  assertClient(client, 'ageUnmatchedIntents');
  assertSlug(partner_slug, 'ageUnmatchedIntents');
  if (typeof cutoffIso !== 'string' || cutoffIso === '') {
    throw new TypeError('ageUnmatchedIntents requires cutoffIso');
  }

  if (dryRun) {
    const { data, error } = await client
      .from(INTENT_TABLE)
      .select('id')
      .eq('partner_slug', partner_slug)
      .in('status', MATCHABLE_INTENT_STATUSES)
      .lt('created_at', cutoffIso);
    if (error) throw new Error(`age preview failed for '${partner_slug}': ${error.message}`);
    return (data ?? []).length;
  }

  const { data, error } = await client
    .from(INTENT_TABLE)
    .update({ status: 'no_match' })
    .eq('partner_slug', partner_slug)
    .in('status', MATCHABLE_INTENT_STATUSES)
    .lt('created_at', cutoffIso)
    .select('id');
  if (error) throw new Error(`age unmatched intents failed for '${partner_slug}': ${error.message}`);
  return (data ?? []).length;
}

/**
 * Build a service-role Supabase client from the environment (CLI only; tests inject a client).
 * The service-role key bypasses RLS and is a server secret — never ship it to the browser.
 */
export function createServiceClient(env = process.env) {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing credentials. Reconciliation reads booking_intent + partner_report_line, which ' +
        'are service_role-only; set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The ' +
        'service-role key is a server secret — never put it in the site build or a browser.'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function assertClient(client, fn) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError(`${fn} requires a Supabase client`);
  }
}
function assertSlug(slug, fn) {
  if (typeof slug !== 'string' || slug.trim() === '') {
    throw new TypeError(`${fn} requires a partner_slug`);
  }
}
