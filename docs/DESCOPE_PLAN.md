# Vernal Booking — Gap & De-Scope Plan

**Purpose:** Reconcile the repo against the Vernal Booking mission (pure referral-attribution
platform). Identify what stays, what is out-of-scope, the coupling seams that must be cut before
anything is removed, and the remaining MVP work. **This is a plan — no code changes yet.**

Source of truth: the mission's Included/Excluded boundaries.
- **Included:** partner mgmt, booking gateway, redirect tracking, referral/promo codes, GA4 events,
  booking analytics, CSV reconciliation, commission reporting, partner onboarding/agreements.
- **Excluded:** Adventure Pass, authentication, AI planner, itineraries, rewards, knowledge graph,
  favorites, user profiles, passport.

---

## 1. MVP capability status (the 7 that define the product)

| # | Capability | Status | Evidence |
|---|---|---|---|
| 1 | Booking Gateway `/go/[partner]` | ✅ Built | `src/pages/go/[partner].astro`, `src/islands/GoRedirect.tsx` |
| 2 | Referral code generator | ✅ Built | `generateRefCode` in `src/lib/referrals.ts` (`BW26-7Q3K9F`, unambiguous base32) |
| 3 | Interstitial (≤6s, code shown) | ✅ Built | `GoRedirect.tsx` — `REDIRECT_CAP_MS = 6000`, fails open |
| 4 | Analytics / GA4 events | ✅ Built (naming gap) | `partner_referral`, `booking_intent_created`, `partner_redirect`, `partner_interstitial_view` fire from `GoRedirect.tsx`. Mission names the event `booking_referral`; code uses `partner_referral`. Reconcile the name or document the mapping. |
| 5 | Internal dashboard | 🟡 Off-browser only | `scripts/booking-report.mjs` → static HTML via service-role key. Operational only — **no revenue/commission math yet.** |
| 6 | CSV importer | ❌ Not built | Nothing ingests a monthly partner CSV. `hotel_report` table exists (006) as the target. |
| 7 | Matching engine | ❌ Not built | No ref → promo → guest+arrival → unmatched cascade. |

**The real blocker is not code.** `offerConfirmed: false` in `src/data/partners.ts` gates promo-code
attribution and everything downstream. Milestones 7–10 (importer → matching → commission → pilot)
all sit behind the Best Western GM meeting. Building 6 & 7 before that meeting is speculative.

---

## 2. File inventory: keep vs. relocate

### KEEP — attribution spine + marketing top-of-funnel (in-scope)
- **Gateway/attribution:** `src/pages/go/[partner].astro`, `src/islands/GoRedirect.tsx` *(after decoupling — see §3)*,
  `src/lib/referrals.ts`, `src/data/partners.ts`, `src/lib/analytics.ts`, `src/lib/supabase.ts`
- **Lead capture (partner/business funnel):** `src/lib/leads.ts`, `src/islands/CorporateRateForm.tsx`,
  `src/pages/corporate-rates.astro`
- **Marketing site (AdventureToursVernal — where every visit begins):** `src/pages/index.astro` and the
  SEO hotel landing pages (`best-hotel-in-vernal-utah`, `hotel-near-*`, `pet-friendly-*`, etc.),
  `src/components/*` (Header, Footer, CTA, StickyBookingBar, FAQ…), `src/layouts/BaseLayout.astro`,
  `src/data/business.ts`
- **DB (in-scope tables):** `partner`, `offer`, `lead` (001); `booking_intent`, `hotel_report` (006)

### RELOCATE to adventureastro — Adventure Pass (excluded)
- `src/pages/pass.astro`
- `src/islands/Pass*.tsx` — PassDashboard, PassSignIn, PassProfileForm, PassAdventureBrowser,
  PassTripPlanner, PassTripStatus, PassMemberHome, PassMyAdventures, `pass-ui.tsx`
- `src/lib/` — `auth.ts`, `profile.ts`, `favorites.ts`, `trip.ts`, `trip-plan.ts`, `recently-viewed.ts`
- **DB:** `member_profile`, `itinerary` (001), `favorite` (005)

### RELOCATE to adventureastro — Knowledge Graph (excluded)
- `src/data/attractions.ts`, `src/data/attractions.generated.ts`, `src/data/attraction-types.ts`
- `src/lib/destination.ts`
- `scripts/generate-catalogue.mjs`
- Attraction-driven pages that are graph content rather than hotel SEO — review
  `src/pages/explore.astro`, `things-to-do-vernal-utah.astro`, `vernal-utah-travel-guide.astro`
  case by case (a static SEO page can stay; a live-catalogue browse belongs in adventureastro).
- **DB:** `destination`, `location`, `location_edge` (001) and their graph functions (003)

> Note: `event` (001) is ambiguous — the mission lists **Event** as a valid partner *type*, so the
> table may be repurposed as partner-scoped rather than deleted. Decide during execution.

---

## 3. Coupling seams — CUT BEFORE REMOVING (this is the risk)

The gateway — the "heart of the platform" — imports the excluded subsystem. The coupling is a single
optional, time-boxed, fail-open **journey snapshot** and is severable without touching attribution:

1. **`src/islands/GoRedirect.tsx`** — remove imports `getSession`/`getTrip`/`getFavoriteSlugs`
   (lines ~20–22) and the journey-snapshot block (lines ~90–115: `savedSlugs`/`interests`/`hasItinerary`).
   The ref-code mint, URL build, `recordBookingIntent`, GA4 events, dwell, and redirect are all
   independent of it. *(`getSession` also supplies `userId`; if member attribution is wanted without
   full Pass, keep a minimal anonymous-or-uid read, else drop `userId` too.)*
2. **`src/lib/referrals.ts`** — drop `savedSlugs`/`interests`/`hasItinerary` from `RecordInput` and the
   `row` written to `booking_intent`.
3. **DB — migration 008 (`008_booking_journey.sql`)** adds exactly these three columns to
   `booking_intent`. Do **not** edit past migrations (they may be applied in prod). Add a **new**
   migration to drop `saved_slugs`/`interests`/`has_itinerary`, or leave them (harmless, `not null
   default` — no writer means they stay empty).
4. **Nav:** verified — `Header.astro`/`Footer.astro`/`BaseLayout.astro` do **not** link to `/pass` or
   `/explore`, so removing Pass pages won't break marketing navigation. Re-grep before deleting in case
   links were added.

**Order matters:** decouple GoRedirect + referrals (steps 1–2) and confirm the gateway still builds and
redirects, *then* remove Pass/graph files, *then* the DB drop migration. Never delete first.

---

## 4. DB / migration-history constraint

Migrations 001–008 are sequential history. De-scoping the schema is **additive**: write new migrations
that `drop table`/`drop column` for excluded objects — never rewrite an applied migration. Simplest safe
path: leave excluded tables in place (they cost nothing once no code reads them) and only drop the
`booking_intent` journey columns if you want the table clean. Full teardown can wait until the Pass/graph
code has actually moved to adventureastro.

---

## 5. Remaining MVP work, in mission order (all downstream of the GM meeting)

1. **GM meeting** (Milestone 10 prerequisite) — confirm monthly CSV, confirmation #, arrival/departure,
   promo code, room nights, revenue, commission willingness. Flip `offerConfirmed` only after sign-off.
2. **#6 CSV importer** — map confirmation/arrival/departure/guest/promo/nights/revenue into `hotel_report`.
3. **#7 Matching engine** — explainable cascade: ref code → promo code → guest+arrival → unmatched.
4. **#5 dashboard → commission** — extend `booking-report.mjs` (or a real internal view) with room nights,
   attributed revenue, commission earned, conversion %.
5. **#4 event-name reconciliation** — align `partner_referral` ↔ mission's `booking_referral` (rename or
   document), a 10-minute cleanup.

---

## 6. Recommended sequence

1. **Decouple** the gateway from Pass (§3 steps 1–2); verify `/go/[partner]` still mints, records, and
   redirects. *Low risk, high value — removes the scope violation at the core.*
2. **Relocate** Pass + Knowledge Graph code to adventureastro (§2). *Mechanical once decoupled.*
3. **Additive DB cleanup** (§4) — optional, after code has moved.
4. **Hold** on #6/#7 until the GM meeting confirms the reconciliation contract exists.
