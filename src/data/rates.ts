// src/data/rates.ts
//
// SINGLE SOURCE OF TRUTH for published room pricing.
//
// WHY THIS FILE EXISTS: rates were previously hardcoded across 20 pages. They had
// already drifted — index.astro's FAQ JSON-LD advertised a "Standard King $700/week"
// that appears on no other page, including the dedicated weekly-rates page. A guest
// or crew coordinator quoting a price the front desk won't honor is the same failure
// mode as an unhonored best-rate guarantee (Report §12).
//
// HOW TO CHANGE A RATE: edit the number here. Every page, table, meta description,
// and JSON-LD Offer updates on the next build. Do not hardcode a price in a page.
//
// `null` means NOT PUBLISHED — helpers below render the callForPricing copy instead.
// This is the same publication gate as BUSINESS.bookDirect[].confirmed: we would
// rather say "call" than publish a number nobody has confirmed.

export const RATES = {
  currency: 'USD',
  weekNights: 7,
  /** Every published rate is quoted before tax; say so wherever a number appears. */
  taxNote: '+ tax',
  callForPricing: 'Call for pricing',

  /** 7-night rates. null = awaiting GM confirmation, renders as callForPricing. */
  weekly: {
    standardQueen: 588,
    doubleQueen: 660,
    /** Published on the homepage (rate card, rate table, and an Offer in JSON-LD) but
     *  MISSING from /weekly-hotel-rates-vernal-utah, which is the page that ranks for
     *  rate queries. The gap is on the rate page, not here — add the row when the
     *  cluster is rewritten. */
    standardKing: 700,
    /** Homepage rate table says "Call for rate"; no number has ever been published. */
    jacuzziSuite: null as number | null,
  },

  /** Monthly rates. All null: the site currently ranks for "monthly hotels vernal
   *  utah" (position ~10) while publishing no monthly price at all. Highest-value
   *  gap in the extended-stay cluster — fill these in the moment the GM confirms. */
  monthly: {
    standardQueen: null as number | null,
    doubleQueen: null as number | null,
    standardKing: null as number | null,
    jacuzziSuite: null as number | null,
    /** 28 or 30 — needed so "per night" math on monthly rates is honest. */
    nights: null as number | null,
  },
} as const;

/** "$588" — or the call-for-pricing copy when the rate is not published. */
export function usd(amount: number | null): string {
  return amount === null ? RATES.callForPricing : `$${amount}`;
}

/** "$84" — derived, never stored, so per-night can never drift from the weekly rate. */
export function perNight(total: number | null, nights: number | null = RATES.weekNights): string {
  if (total === null || !nights) return RATES.callForPricing;
  return `$${Math.round(total / nights)}`;
}

/** True when at least one monthly rate is published — gate monthly UI on this. */
export const hasMonthlyRates: boolean = Object.entries(RATES.monthly)
  .filter(([k]) => k !== 'nights')
  .some(([, v]) => v !== null);

export type Rates = typeof RATES;
