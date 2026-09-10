// src/data/schema.ts
//
// SINGLE SOURCE OF TRUTH for the hotel's identity in structured data.
//
// WHY THIS FILE EXISTS: four pages independently declared the hotel as a
// top-level entity and two more declared it inline (`Person.worksFor`,
// `TouristDestination.isPartOf`). None carried an `@id`, so a crawler had six
// equivalent-but-unlinked nodes to reconcile. They did not agree:
//
//   • index.astro          name "Best Western Vernal Inn"          tel +14357896625
//   • dog-friendly-…       name "Best Western Extended Stay Vernal" tel +18015971696  ← different NUMBER
//   • naples-utah-hotel    name "Best Western Extended Stay Vernal" tel +14357896625
//   • oilfield-housing-…   name "Best Western Extended Stay Vernal" tel +18015971696  ← different NUMBER
//   • explore / faq        name "Best Western Extended Stay Vernal" (nested, no tel)
//
// That is the exact failure `business.ts` was written to make impossible — it
// just never reached the JSON-LD, because the schema blocks were migrated
// verbatim as opaque strings. Two names and two phone numbers for one hotel is
// not a duplication problem, it is an identity problem: it asks Google to decide
// which of two businesses this is.
//
// THE FIX: one node, one `@id`, built from BUSINESS. Every other mention is a
// reference to that `@id`, never a re-declaration.
//
// HOW TO CHANGE A FACT: edit `business.ts`. Nothing here restates a value.

import { BUSINESS } from './business.ts';
import { RATES } from './rates.ts';

/** The canonical node identifier for the hotel. Domain-rooted and page-independent
 *  by design: the entity is the hotel, not any one URL, so this `@id` must not
 *  change when a page is renamed or retired. Durable contract — never edit it. */
export const HOTEL_ID = `${BUSINESS.site.domain}/#hotel` as const;

/** Amenities asserted on the canonical entity.
 *
 *  This is the UNION of what the six divergent nodes already published, not a new
 *  set of claims — consolidating identity must not quietly drop a claim a page
 *  makes today. Near-duplicates were folded into the wording the homepage already
 *  used ("Pets Allowed"/"Dogs Allowed" → Pet Friendly; "Laundry Facilities" →
 *  Laundry Service; "Extended Stay Rates" → Weekly Rates).
 *
 *  Provenance of the four that were not already on the homepage:
 *    Truck Parking     — oilfield-housing, naples; also BUSINESS.bookDirect 'free-parking' (confirmed)
 *    Weekly Rates      — oilfield-housing, naples, dog-friendly. NOTE: RATES.weekly
 *                        is now all-null (quoted by phone), so weeklyOffers()
 *                        below emits nothing. The amenity still advertises that
 *                        weekly rates EXIST, which is true and is the point.
 *    Monthly Rates     — oilfield-housing; homepage FAQ already states monthly rates are available
 *    Corporate Billing — oilfield-housing; homepage FAQ already states corporate billing is available
 *
 *  NOTE: "Monthly Rates" advertises availability, not a price. RATES.monthly is
 *  entirely null (unpublished), which is correct and unrelated — the amenity says
 *  such rates exist, the rate table still says "call". */
const AMENITIES: readonly string[] = [
  'Free Breakfast',
  'Free WiFi',
  'Free Parking',
  'Pet Friendly',
  'Kitchenette',
  'Jacuzzi Suite',
  '24-Hour Front Desk',
  'Laundry Service',
  'Business Center',
  'ADA Accessible Rooms',
  'Truck Parking',
  'Weekly Rates',
  'Monthly Rates',
  'Corporate Billing',
];

const amenityFeature = AMENITIES.map((name) => ({
  '@type': 'LocationFeatureSpecification',
  name,
  value: true,
}));

const postalAddress = {
  '@type': 'PostalAddress',
  streetAddress: BUSINESS.address.street,
  addressLocality: BUSINESS.address.city,
  addressRegion: BUSINESS.address.region,
  postalCode: BUSINESS.address.postalCode,
  addressCountry: BUSINESS.address.country,
};

/** A REFERENCE to the hotel — never a second copy of it.
 *
 *  Use anywhere the hotel is mentioned inside another node (`worksFor`,
 *  `isPartOf`, `containedInPlace`, …). Carries `@type` alongside `@id` because
 *  some validators warn on a bare `@id` even though JSON-LD permits it.
 *
 *  A page that references the hotel should also emit `hotelNode()` so the
 *  reference resolves within that page's own markup rather than dangling. */
export function hotelRef() {
  return { '@type': 'Hotel', '@id': HOTEL_ID };
}

/** The hotel's IDENTITY: who and where it is. Safe to emit on every page — every
 *  value comes from `business.ts`, so no two pages can disagree.
 *
 *  Deliberately excludes offers, ratings, and imagery. Those are the homepage's
 *  fuller assertion (`hotelNodeFull()`); duplicating an `aggregateRating` onto
 *  pages that never carried one would be widening a claim under cover of a
 *  refactor. Same `@id` on both — the graph merges, the claims do not multiply. */
export function hotelNode() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Hotel', 'LodgingBusiness'],
    '@id': HOTEL_ID,
    name: BUSINESS.name,
    // The name three pages published instead of BUSINESS.name. Recorded as an
    // alias rather than deleted: Google has already crawled it, and an explicit
    // alternateName reconciles the two strings to one entity instead of leaving
    // a second, competing one. REVISIT once the legal entity is verified from
    // the franchise records — see docs/BUSINESS_KNOWLEDGE_WORKBOOK.md.
    alternateName: 'Best Western Extended Stay Vernal',
    url: BUSINESS.site.canonicalHome,
    telephone: BUSINESS.phoneE164,
    email: BUSINESS.email,
    address: postalAddress,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS.geo.latitude,
      longitude: BUSINESS.geo.longitude,
    },
    checkinTime: BUSINESS.hours.checkinTime,
    checkoutTime: BUSINESS.hours.checkoutTime,
    openingHours: BUSINESS.hours.openingHours,
    petsAllowed: true,
    priceRange: '$$',
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Credit Card',
    numberOfRooms: '50',
    brand: { '@type': 'Brand', name: BUSINESS.legalBrand },
    amenityFeature,
  };
}

/** Weekly-stay offers, built from RATES. A null rate is UNPUBLISHED and produces
 *  no Offer at all — the same gate as `usd()` rendering "Call for pricing"
 *  (ADR-008: absence of a confirmed value never becomes a published claim). */
function weeklyOffers() {
  const rooms = [
    {
      key: 'standardQueen',
      name: 'Standard Queen',
      description:
        'Standard Queen room with free hot breakfast, free WiFi, free parking. Perfect for solo travelers and couples.',
    },
    {
      key: 'doubleQueen',
      name: 'Double Queen',
      description:
        'Double Queen room with two beds, free hot breakfast, free WiFi, free parking. Ideal for families and groups.',
    },
    {
      key: 'standardKing',
      name: 'Standard King',
      description:
        'Standard King room with free hot breakfast, free WiFi, free parking. Great for business travelers and longer stays.',
    },
  ] as const;

  return rooms
    .map((room) => ({ room, price: RATES.weekly[room.key] as number | null }))
    .filter((r): r is { room: (typeof rooms)[number]; price: number } => r.price !== null)
    .map(({ room, price }) => ({
      '@type': 'Offer',
      name: `Weekly Extended Stay — ${room.name}`,
      itemOffered: {
        '@type': 'Service',
        name: `${room.name} Room — ${RATES.weekNights}-Night Extended Stay`,
        description: room.description,
      },
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price,
        priceCurrency: RATES.currency,
        unitCode: 'WEE',
      },
      availability: 'https://schema.org/InStock',
      url: BUSINESS.site.canonicalHome,
    }));
}

/** The homepage's fuller assertion of the SAME entity — identity plus the
 *  commercial and reputational claims the homepage has always carried.
 *  Emit this on the homepage only; `hotelNode()` everywhere else. */
export function hotelNodeFull(description: string) {
  return {
    ...hotelNode(),
    description,
    // The two night exteriors, then the dining room. The third slot used to be
    // images/59.webp, which is the dining room AS IT WAS BEFORE THE RENOVATION
    // — old chairs, dark granite tables. This array is what Google reads for a
    // rich result, so it was offering searchers a picture of the hotel the
    // owner spent a year replacing. Breakfast-Room.webp is the same room now.
    image: [
      `${BUSINESS.site.domain}/images/35.webp`,
      `${BUSINESS.site.domain}/images/61.webp`,
      `${BUSINESS.site.domain}/images/Breakfast-Room.webp`,
    ],
    starRating: { '@type': 'Rating', ratingValue: '3' },
    // Carried over verbatim from the homepage's existing block. NOT verified
    // against a review platform — flagged in the workbook as owner-confirmable.
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: '47',
      bestRating: '5',
      worstRating: '1',
    },
    makesOffer: weeklyOffers(),
  };
}

/** Serialize a node to a JSON-LD <script>. `<` is escaped so no string value can
 *  terminate the script element early — these are interpolated with `set:html`,
 *  which does no escaping of its own. */
export function ldScript(node: unknown): string {
  const json = JSON.stringify(node, null, 1).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}
