// src/data/business.ts
//
// SINGLE SOURCE OF TRUTH for name / address / phone / pricing / booking.
// Every value below is lifted VERBATIM from the legacy site's existing
// JSON-LD and visible markup — nothing was invented or "improved".
// Footer, Header, schema blocks, and CTAs all import from here so a
// NAP/price mismatch becomes impossible (runbook Part 3).

export const BUSINESS = {
  name: 'Best Western Vernal Inn',
  legalBrand: 'Best Western',
  // Phone — displayed and tel: forms exactly as used across the site.
  phoneDisplay: '(435) 789-6625',
  phoneTel: '4357896625',
  phoneE164: '+14357896625',
  email: 'surestayplus53027@gmail.com',

  // Address (NAP) — matches PostalAddress in every LocalBusiness block.
  address: {
    street: '1935 South 1500 East',
    city: 'Vernal',
    region: 'UT',
    postalCode: '84078',
    country: 'US',
    full: '1935 South 1500 East, Vernal, UT 84078',
  },

  geo: {
    latitude: 40.4474,
    longitude: -109.5194,
  },

  // Front desk is staffed continuously per existing schema.
  hours: {
    openingHours: 'Mo-Su 00:00-23:59',
    checkinTime: '15:00',
    checkoutTime: '11:00',
    display: '24-Hour Front Desk',
  },

  // External booking engine used by every "Book Now" CTA / Offer URL.
  bookingUrl: 'https://www.theworld24.com/booking/executiveinnsuites.php',

  site: {
    domain: 'https://bestwesternvernalinn.com',
    canonicalHome: 'https://bestwesternvernalinn.com/',
    logo: '/images/logo.webp',
    ogImage: 'https://bestwesternvernalinn.com/images/35.webp',
  },

  // Partners shown in the footer.
  partners: {
    management: { name: 'MSC Companies', url: 'https://www.msccompanies.com' },
    poweredBy: { name: 'cozelosdata.com', url: 'https://cozelosdata.com' },
  },

  lastUpdated: 'February 2026',
} as const;

export type Business = typeof BUSINESS;
