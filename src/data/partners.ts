// src/data/partners.ts
//
// PUBLIC referral config for the /go outbound-attribution pipe. One entry per
// booking partner, keyed by a stable `slug` that matches booking_intent.partner_slug
// (migration 006) and, later, partner.slug in the DB. This holds PUBLIC fields only —
// commission % and report email live server-side in the `partner` table, never here.
//
// Single-tenant reality today: just the hotel. Adding a tour operator, raft company,
// or restaurant later is a new entry here — the booking_intent row shape already fits.
//
// CLAIMS DISCIPLINE (mirrors business.ts bookDirect): `promoCode` + `offer` are a
// promise the partner must actually honor at the desk. An unhonored claim is worse
// than none. So the guest-facing code/offer is shown ONLY when `offerConfirmed` is
// true — flip it to true after the GM registers the code in the booking engine AND
// agrees to honor the offer, no code change beyond this flag. Until then the pipe
// still records every click (attribution works); the interstitial just stays neutral
// and the promo param is withheld from the outbound URL.
import { BUSINESS } from './business';

// Hotels are only the FIRST partner type. The whole engine (route, booking_intent,
// interstitial, dashboard) is partner-type agnostic — adding a museum, restaurant,
// ATV/raft outfitter, or attraction is a config entry here, never a routing change.
// `type` is purely descriptive: it groups the dashboard and labels the interstitial;
// no code branches on it.
export type PartnerType = 'hotel' | 'museum' | 'restaurant' | 'atv' | 'rafting' | 'attraction';

export type Partner = {
  slug: string;
  name: string;
  type: PartnerType; // descriptive only — no routing/behaviour depends on it
  bookingUrl: string; // the engine we cannot see past — always reached via /go
  promoCode: string; // guest says it at check-in; the load-bearing attribution key
  refPrefix: string; // human ref-code prefix, e.g. 'BW' → BW26-7Q3K9F
  offer: string; // the reason to say the code out loud (shown only when confirmed)
  offerConfirmed: boolean; // GATE: false until the GM registers the code + honors the offer
};

export const PARTNERS: Record<string, Partner> = {
  'best-western-vernal': {
    slug: 'best-western-vernal',
    name: BUSINESS.name,
    type: 'hotel',
    bookingUrl: BUSINESS.bookingUrl,
    promoCode: 'ADVENTURE',
    refPrefix: 'BW',
    offer: 'Mention this code at check-in for your free Vernal Adventure Pass welcome guide.',
    offerConfirmed: false, // ⛔ NEEDS GM sign-off (register "ADVENTURE" + honor the guide)
  },
};

export function getPartner(slug: string): Partner | undefined {
  return PARTNERS[slug];
}

export const PARTNER_SLUGS = Object.keys(PARTNERS);
