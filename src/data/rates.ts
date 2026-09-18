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
//
// CURRENT STATE (hotel instruction, 2026-09-03; extended 2026-09-09):
//   nightly — CONFIRMED, published, SEVEN room types, $95 to $155. The Studio
//             Queen (then "Queen Suite") at $95 was added on 2026-09-09 and is
//             the lowest published rate on the card; see the key's own note.
//             The Studio Jacuzzi King at $149 is the seventh, confirmed by the
//             owner on 2026-09-17.
//   weekly  — WITHDRAWN. Quoted by phone only. Every customer-facing weekly
//             dollar amount has been removed from the site; the copy is
//             WEEKLY_CALL_LINE. Do not restore $588 / $660 / $700.
//   monthly — never published, still awaiting confirmation.
// The two rates are independent: never divide a weekly rate to make a nightly one
// (that is where the retired "$84/night" came from), and never multiply a nightly
// rate to make a weekly one.

export const RATES = {
  currency: 'USD',
  weekNights: 7,
  /** Every published rate is quoted before tax; say so wherever a number appears. */
  taxNote: '+ tax',
  callForPricing: 'Call for pricing',

  /** 7-night rates. ALL NULL BY INSTRUCTION (hotel, 2026-09-03): the hotel now
   *  publishes a nightly rate card and quotes weekly stays by phone only. The
   *  $588 / $660 / $700 that used to sit here are WITHDRAWN — do not restore them
   *  because they were once published, and never derive a weekly figure from a
   *  nightly one. Nulling them here is the whole fix: usd() renders the
   *  callForPricing copy, weeklyOffers() in schema.ts emits no Offer, and every
   *  page that reads this object stops advertising a weekly price. */
  weekly: {
    standardQueen: null as number | null,
    doubleQueen: null as number | null,
    standardKing: null as number | null,
    jacuzziSuite: null as number | null,
  },

  /** Published NIGHTLY rates, by room type. CONFIRMED by the hotel 2026-09-03 —
   *  these are real one-night prices, not the weekly rate divided by seven, so
   *  nightlyQuote() drops the "From" qualifier and the 7-night explanation that
   *  a derived number has to carry. Keys are the hotel's own room names.
   *  A null here is still the publication gate: it renders as callForPricing. */
  nightly: {
    /** The Studio Queen — named "Queen Suite" until 2026-09-16, when the owner
     *  renamed it ("they are not suites") and confirmed the rate again in
     *  writing: "$95 a night for the Studio Queen". First added 2026-09-09 from
     *  a labelled frame reading "Queen Suite" over a "$95/night" badge; the
     *  photos are in public/images/Queen-Studio/ (Queen-Suite/ until the
     *  owner renamed the folder on 2026-09-17). This is the
     *  lowest published rate on the card — below the $108 Studio King — so
     *  it is the number a guest comparing Vernal hotels sees first. */
    studioQueen: 95 as number | null,
    studioKing: 108 as number | null,
    studioTwoQueen: 120 as number | null,
    /** $120 from 2026-09-17, on the owner's instruction ("the Studio handicap
     *  king needs to be changed to $120 a night"). It was $108 — the same as the
     *  standard Studio King — and several pages said so in prose ("the same
     *  rate as the Studio King", "not a premium"); those sentences were removed
     *  in the same change. The homepage gallery's labelled tile for this room
     *  had "$108" baked into its pixels; the owner re-exported it the same day
     *  as Handicapped-studio-$120.webp, and homeGallery.ts's build guard now
     *  checks it against this number. */
    accessibleStudioKing: 120 as number | null,
    petFriendlyStudioTwoQueen: 155 as number | null,
    petFriendlyRoom: 135 as number | null,
    /** The Studio Jacuzzi King — added 2026-09-16 as "Jacuzzi King Suite", when
     *  the owner asked for its page; named as on the owner's re-exported label
     *  on 2026-09-17 ("use only Studio, not Suite").
     *  $149 — CONFIRMED BY THE OWNER IN WRITING on 2026-09-17 ("confirm 149").
     *  It sat at null for a day on purpose: the only evidence was the price
     *  badge on the owner's labelled export, and the Studio Queen's $95 had
     *  likewise gone live only once confirmed in writing. The room page, nav,
     *  homepage rate table, hero card, room tab, weekly-rates page and the room
     *  page's JSON-LD Offer all read this number; the homepage gallery's
     *  labelled tile prints it too and is guarded against it. */
    studioJacuzziKing: 149 as number | null,
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

/** "$108" — or the call-for-pricing copy when the rate is not published. */
export function usd(amount: number | null): string {
  return amount === null ? RATES.callForPricing : `$${amount}`;
}

/** Divides a multi-night total into a per-night figure. Retained for the monthly
 *  rates, whose "per night" math has to stay honest once RATES.monthly is filled
 *  in. It must NOT be pointed at RATES.weekly again: dividing a week by seven is
 *  exactly how the withdrawn "$84/night" got onto ten pages. */
export function perNight(total: number | null, nights: number | null = RATES.weekNights): string {
  if (total === null || !nights) return RATES.callForPricing;
  return `$${Math.round(total / nights)}`;
}

/** The lowest CONFIRMED nightly rate, as copy: "$108".
 *
 * Every "rates from …" headline, SEO title and FAQ answer reads this. It replaces
 * the hardcoded "$84", which was never a nightly rate at all — it was the now
 * withdrawn $588 week divided by seven, and it undercut the real floor by $24 a
 * night. Derived from RATES.nightly, so a rate-card change can never leave a
 * stale "from" price behind on a page nobody remembered to open. */
const PUBLISHED_NIGHTLY: number[] = Object.values(RATES.nightly).filter(
  (v): v is number => v !== null
);
export const LOWEST_NIGHTLY: string = PUBLISHED_NIGHTLY.length
  ? `$${Math.min(...PUBLISHED_NIGHTLY)}`
  : RATES.callForPricing;

/** What a room's per-night price line should say.
 *
 * Two states: a confirmed nightly rate, or the callForPricing copy. There used to
 * be a third — derive the nightly price from the weekly rate and label it
 * "From $84 · per night on a 7-night stay" — which is gone by instruction
 * (2026-09-03). Deriving one kind of rate from another is what put an unhonoured
 * "$700/week" in the homepage FAQ before this file existed, and the function no
 * longer accepts a weekly rate at all, so it cannot come back by accident. */
export type NightlyQuote = {
  /** "$108", or the callForPricing copy when nothing can be published. */
  price: string;
  /** Always "" now. Kept so the hero's markup does not need a shape change if a
   *  qualifier is ever legitimately needed again (e.g. a seasonal "from"). */
  qualifier: string;
  /** Fine print under the price. */
  note: string;
  /** false when there is no number at all — style the badge down, don't fake one. */
  published: boolean;
};

export function nightlyQuote(nightly: number | null): NightlyQuote {
  if (nightly !== null) {
    // A confirmed rate needs no qualifier and no explanation — the price row
    // already reads "$108 / night", so the fine print is only the tax note.
    return { price: usd(nightly), qualifier: '', note: RATES.taxNote, published: true };
  }
  return { price: RATES.callForPricing, qualifier: '', note: 'Call for tonight’s rate', published: false };
}

/** The weekly message, everywhere it appears on the site.
 *
 * Deliberately constants, not functions of RATES.weekly. The hotel's instruction
 * (2026-09-03) is that weekly stays are quoted by phone: no weekly dollar amount
 * is authorised anywhere customer-facing, and none is to be derived from a
 * nightly rate. WEEKLY_CALL_LINE is the label form used in the hero ribbon and
 * rate tables; WEEKLY_CALL_PHRASE drops into a sentence. */
export const WEEKLY_CALL_LINE = 'Weekly Rates — Call for Price';
export const WEEKLY_CALL_PHRASE = 'call for price';

/** True when at least one monthly rate is published — gate monthly UI on this. */
export const hasMonthlyRates: boolean = Object.entries(RATES.monthly)
  .filter(([k]) => k !== 'nights')
  .some(([, v]) => v !== null);

export type Rates = typeof RATES;
