// Outbound booking-attribution service. Powers /go: mint a per-click ref code,
// build the destination URL with attribution params, and record the intent to the
// Supabase `booking_intent` table (anon INSERT allowed by RLS `bi_insert`, 006).
//
// Fails open, like leads.ts: if Supabase isn't configured, or the insert errors, the
// caller STILL redirects — an unrecorded click must never cost the guest a booking.
import { supabase, isSupabaseConfigured } from './supabase';
import type { BookingIntentInsert } from './database.types';
import type { Partner } from '../data/partners';

// Unambiguous base32 alphabet — no 0/O/1/I/L, so a code read aloud at a front desk
// or copied off a screen doesn't get garbled.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomToken(len: number): string {
  // crypto in the browser; fall back to a non-crypto source only if unavailable
  // (SSR/prerender never calls this — /go is client:only). Uniqueness is backstopped
  // by the DB unique constraint + default, so a weak source is not a correctness risk.
  const out: string[] = [];
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(len);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < len; i++) out.push(ALPHABET[bytes[i] % ALPHABET.length]);
  } else {
    for (let i = 0; i < len; i++) out.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }
  return out.join('');
}

// e.g. BW26-7Q3K9F — prefix (partner) + 2-digit year + 6-char token. Human-readable
// so it survives a hand-written folio note; unique enough that collisions are handled
// by the DB, not by us.
export function generateRefCode(prefix: string, now: Date = new Date()): string {
  const yy = String(now.getFullYear() % 100).padStart(2, '0');
  return `${prefix}${yy}-${randomToken(6)}`;
}

export type BookingParams = {
  checkin?: string | null;
  checkout?: string | null;
  partySize?: number | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

// Build the outbound URL. `ref` and utm_* always ride along (harmless if the engine
// ignores them); `promo` is appended ONLY when the partner's offer is GM-confirmed —
// we don't push an unregistered code into a live booking engine.
export function buildDestinationUrl(
  partner: Partner,
  refCode: string,
  params: BookingParams = {}
): string {
  let url: URL;
  try {
    url = new URL(partner.bookingUrl);
  } catch {
    return partner.bookingUrl; // malformed config → hand back verbatim, still redirect
  }
  const q = url.searchParams;
  q.set('ref', refCode);
  q.set('utm_source', params.utmSource || 'bestwesternvernalinn');
  q.set('utm_medium', params.utmMedium || 'referral');
  q.set('utm_campaign', params.utmCampaign || 'book_direct');
  if (partner.offerConfirmed) q.set('promo', partner.promoCode);
  if (params.checkin) q.set('checkin', params.checkin);
  if (params.checkout) q.set('checkout', params.checkout);
  return url.toString();
}

export type RecordInput = {
  partner: Partner;
  refCode: string;
  params?: BookingParams;
  userId?: string | null;
  itineraryId?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
};

export type RecordResult =
  | { ok: true; via: 'supabase' }
  | { ok: true; via: 'skipped' } // no backend configured — click still redirected
  | { ok: false; error: string };

// Best-effort write. Callers await this DURING the interstitial dwell, then redirect
// regardless of the result — never block or fail the redirect on it.
export async function recordBookingIntent(input: RecordInput): Promise<RecordResult> {
  if (!isSupabaseConfigured || !supabase) return { ok: true, via: 'skipped' };

  const row: BookingIntentInsert = {
    partner_slug: input.partner.slug,
    ref_code: input.refCode,
    promo_code: input.partner.promoCode,
    user_id: input.userId ?? null,
    itinerary_id: input.itineraryId ?? null,
    checkin: input.params?.checkin ?? null,
    checkout: input.params?.checkout ?? null,
    party_size: input.params?.partySize ?? null,
    landing_page: input.landingPage ?? null,
    referrer: input.referrer ?? null,
    utm_source: input.params?.utmSource ?? null,
    utm_medium: input.params?.utmMedium ?? null,
    utm_campaign: input.params?.utmCampaign ?? null,
    device: deviceHint(),
  };

  const { error } = await supabase.from('booking_intent').insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true, via: 'supabase' };
}

function deviceHint(): string | null {
  if (typeof navigator === 'undefined') return null;
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}
