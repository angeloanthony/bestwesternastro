# Commercial Booking Cluster — Strategy & Architecture

**Best Western Vernal Inn · bestwesternvernalinn.com**
Status: design document. No pages written yet.
Author: SEO/IA strategy pass, 2026-07-31.
Companion docs: `docs/DESTINATION_PAGE_STANDARD.md` (editorial standard, already in force).

---

## 1. Executive Summary

### What this document decides

The commercial cluster is reorganized around **what the visitor has to decide**, not **who the visitor is**. Job-title pages (construction crews, utility contractors, project managers, pipeline crews) are rejected as doorway pages. Their content becomes segments *inside* pages and an entity layer, not separate URLs.

The cluster goes from 4 real pages + 1 noindexed stub to **15 pages in three tiers**: a hub, six rate/operations spokes, and a seven-page procurement center under `/business/`.

### The five findings that drive it

**1. The existing cluster is three clones of one page.**
`weekly-hotel-rates-vernal-utah` (171 lines), `extended-stay-hotel-vernal-utah` (173), and `workforce-housing-vernal-utah` (174) share the same H2 skeleton, the same seven-item amenity list, the same rate table, the same "monthly rates available — call" line, and the same 16-link mesh block. They differ mainly in the hero paragraph. Google is being asked to pick a winner among three near-identical documents targeting one intent.

**2. This is the Ashley failure mode, already diagnosed.**
Search Console (Apr 29 – Jul 28 2026) showed the Ashley page drawing 4,049 impressions at position 10.4 with **zero clicks**, ranking nationally for the wrong forests, because it was ~90% reusable template copy that Google couldn't bind to a specific entity. The commercial cluster has the same disease, undiagnosed only because it draws less traffic. Scaling the current template to 16 audience pages would multiply the weakness — the explicit warning already recorded in the project memory.

**3. The site does not lose on indexing or CTR. It loses on discovery.**
24 of 26 pages earn impressions. But 81% of clicks land on the homepage and 54 of 56 query-attributed clicks are branded. The site converts people who already know the hotel. The commercial cluster's job is to win people who don't — which requires pages that answer questions, not pages that restate amenities.

**4. The highest-value gap in the entire site is monthly pricing.**
The site ranks ~position 10 for "monthly hotels vernal utah" while publishing **no monthly price and no monthly page**. Every monthly rate in `src/data/rates.ts` is `null`. This is a ranking the site already earned and cannot convert. See §5.

**5. The blocker is business facts, not engineering.**
Monthly rates, the Jacuzzi weekly rate, W-9/COI documents, direct-billing terms, tax-exemption handling, and confirmation that $588/$660/$700 are current — none of these are code problems. The single highest-leverage deliverable in this plan is the **Owner Review Packet** (§10, Immediate), which is roughly 20 questions that unblock nine pages at once.

### What is deliberately not recommended

No framework change, no URL restructure of ranking pages, no architecture rebuild. Existing flat keyword URLs keep their equity; the silo is expressed through breadcrumbs, a hub page, and contextual linking rather than directories.

### Corrections to assumptions in the brief

| Assumption | Reality |
|---|---|
| "Corporate Rates page exists" | `src/pages/corporate-rates.astro` is `robots="noindex, follow"` — a 54-line form stub. Not an SEO asset. |
| "Jacuzzi Suites page exists" | No such page. Jacuzzi is mentioned across 7 pages; no dedicated page, and `RATES.weekly.jacuzziSuite` is `null`. |
| 16-page architecture incl. job-title pages | 7 of those are doorway pages. Replaced with a real procurement center — see §3. |
| "FAQPage schema where eligible" | FAQ rich results were restricted to government/health sites in Aug 2023. No hotel page is eligible. Keep the markup only where it earns extraction value, not SERP features. See §7. |

---

## 2. Commercial SEO Strategy

### 2.1 The positioning claim

> The most useful lodging resource for people working in the Uinta Basin — whether or not they stay here.

This is the editorial standard from the brief, and it is also the ranking strategy. The hotel wins the booking because the page answered the question, not because the page asked for the booking.

### 2.2 Why job-title pages are rejected

The brief proposes Government Travelers, Construction Crews, Traveling Nurses, Utility Contractors, and Project Managers as separate pages. Consider what each would actually contain:

- Weekly and monthly rates → identical
- Kitchenettes, breakfast, laundry, parking → identical
- Truck/trailer parking → identical
- Corporate billing → identical
- 24-hour desk for shift schedules → identical
- Airport distance → identical

A pipeline welder, a utility lineman, and a construction foreman staying six weeks in Vernal have **the same lodging decision**. They are not different search intents; they are different nouns in front of the same intent. Publishing five pages that vary only the noun is the definition of a doorway page set, and it is the pattern the brief itself asks to avoid.

**The test applied throughout this document:** a page earns a URL only if it answers a question the other pages cannot answer, or serves a transaction the other pages cannot serve.

Two audience pages pass that test:

- **Government / per diem travelers** — pass. Not a different job title; a different *transaction*. GSA per diem ceilings, state tax-exemption forms, government ID at check-in, direct-bill to agency. Genuinely distinct decision criteria.
- **Traveling nurses** — conditional pass. Distinct query set, distinct contract structure (13-week terms), distinct anchor entity (Ashley Regional Medical Center). Ships **only** if the hotel can state something real about 13-week terms. If not, it stays a segment on the extended-stay page. Gated in §10.

Everyone else becomes a named segment inside an existing page — which is better for them anyway, because a crew lead searching "hotel for construction crew vernal" lands on a page that also tells them about billing, parking, and shift check-in.

### 2.3 The cannibalization fix, in one rule

> **The full rate table appears on exactly two pages: `/weekly-hotel-rates-vernal-utah` and `/monthly-hotel-rates-vernal-utah`.**
> Every other commercial page carries a single "from $X/week — see full rates →" line linking to them.

This one rule removes the largest block of duplicated content across the cluster and forces each remaining page to justify itself on non-price content. Enforce it in `scripts/verify-destination-pages.mjs`.

### 2.4 Intent decomposition

Three buyer states, in order of funnel position:

| State | Question being asked | Buyer | Pages |
|---|---|---|---|
| **Price** | "What does it cost to stay a while?" | The guest, self-paying or per diem | Weekly, Monthly, Extended Stay |
| **Operations** | "Will this work for my crew / my rotation?" | Crew lead, coordinator, the worker | Workforce Housing, Oilfield Housing |
| **Procurement** | "How do I get my company to pay for this?" | Coordinator, AP clerk, procurement | `/business/*` |

Procurement is the least contested and highest-converting. Almost no independent hotel site in Utah publishes a W-9, a COI process, or direct-billing terms. Search volume is low; conversion value per visit is very high; and it produces repeat corporate bookings rather than one-off stays. This is where the cluster's durable advantage is, and it is the part the brief was most right about.

### 2.5 What "scalable for future industries and employers" actually means

The scalable unit is **the employer relationship**, not the job title. A page about "utility contractors" scales to nothing. A page built from a real negotiated relationship — a named company, its actual project, a real rate agreement, a real point of contact — scales to every future company the hotel signs. That template ships in the Future phase (§10) and only with signed relationships behind it. Publishing employer names without agreement is a business-relationship fabrication and is forbidden by the constraints.

---

## 3. Site Architecture

### 3.1 The silo

```
/corporate-lodging-vernal-utah          ← HUB (new)
│
├── RATE & DURATION ─────────────────────────────────────
│   ├── /weekly-hotel-rates-vernal-utah      (exists — refocus to price)
│   ├── /monthly-hotel-rates-vernal-utah     (new — highest priority)
│   └── /extended-stay-hotel-vernal-utah     (exists — refocus to lived experience)
│
├── OPERATIONS ──────────────────────────────────────────
│   ├── /workforce-housing-vernal-utah       (exists — refocus to B2B buyer)
│   └── /oilfield-housing-vernal             (exists — keep, deepen)
│
├── QUALIFIED AUDIENCE ──────────────────────────────────
│   ├── /government-per-diem-lodging-vernal  (new — gated on facts)
│   └── /travel-nurse-housing-vernal-utah    (new — conditional, Phase 3)
│
└── PROCUREMENT CENTER ──────────────────────────────────
    └── /business/                            (new — hub)
        ├── /business/direct-billing
        ├── /business/corporate-accounts
        ├── /business/tax-exempt-stays
        ├── /business/documents               (W-9 + COI + ACH, one page)
        ├── /business/room-blocks
        └── /business/corporate-rates         (moved from /corporate-rates)
```

**15 pages.** Five exist in some form, ten are new, one moves.

### 3.2 URL policy

**Ranking pages keep flat keyword URLs.** `/weekly-hotel-rates-vernal-utah` stays exactly where it is. Canonicals and redirects were just stabilized; moving earning URLs to `/commercial/...` would spend that work for a directory structure Google does not need. Silo membership is communicated by breadcrumbs and link topology, which is what actually carries the signal.

**Procurement pages use `/business/`.** They are new, have zero equity to protect, are transactional rather than keyword-led, and benefit from reading as a coherent sub-application to a procurement officer scanning a URL bar. The mixed convention is intentional and the split is clean: keyword-led pages are flat, application-led pages are nested.

**`/corporate-rates` → `/business/corporate-rates`,** 301. Safe: the page is currently `noindex`, so there is no ranking to lose.

### 3.3 Pages explicitly rejected, with reasons

| Proposed | Verdict | Where it goes instead |
|---|---|---|
| Construction Crews | Reject — doorway | Segment on Workforce Housing |
| Utility Contractors | Reject — doorway | Segment on Workforce Housing |
| Project Managers | Reject — doorway | Segment on Workforce Housing + `/business/room-blocks` |
| Pipeline Crews | Reject — doorway | Segment on Oilfield Housing |
| Corporate Travel Center | Reject — is the hub | `/corporate-lodging-vernal-utah` + `/business/` |
| W-9 Download | Reject — thin (a PDF link and 80 words) | `/business/documents` |
| Certificate of Insurance | Reject — thin | `/business/documents` |
| Credit Application | Merge | `/business/corporate-accounts` |
| Company Reservations | Merge | `/business/room-blocks` |
| Long-Term Projects | Merge | `/business/room-blocks` |
| Procurement Contact | Merge | `/business/` hub + `ContactPoint` schema |

### 3.4 Relationship to the leisure cluster

The commercial silo and the destination silo (`/hotel-near-*`, `/things-to-do-*`, `/explore`) are separate, joined at exactly two points:

1. Every commercial page has one **"On Your Days Off"** section — a genuine need for anyone on a 14-day hitch — linking to 2–3 destination pages.
2. The homepage links to both hubs.

This keeps the destination pages' recreational entity signals out of the commercial pages, where they would dilute the work-lodging topic. It is also the only non-repetitive reason to mention Flaming Gorge on a page about direct billing.

---

## 4. Search Intent Matrix

No two pages share a primary intent. "Booking intent" is scored Low / Medium / High / Transactional.

### Tier 1 — Hub

| | |
|---|---|
| **Page** | `/corporate-lodging-vernal-utah` |
| **Primary keyword** | corporate lodging Vernal Utah |
| **Secondary** | business hotel Vernal Utah; company lodging Uinta Basin; corporate housing Vernal UT; hotel for business travel Vernal |
| **Search intent** | Commercial investigation — orienting, not yet deciding |
| **Ideal visitor** | Coordinator or manager who has just been told "find lodging in Vernal" and does not yet know what they need |
| **Booking intent** | Medium |
| **Internal links** | Down to all six spokes; across to `/business/`; up to `/` |
| **CTA** | Dual: "Call the front desk" + "Request a corporate account". Routing, not closing — this page's job is to hand off to the right spoke |

### Tier 2 — Rate & Duration

| | |
|---|---|
| **Page** | `/weekly-hotel-rates-vernal-utah` |
| **Primary keyword** | weekly hotel rates Vernal Utah |
| **Secondary** | weekly rates hotel Vernal; hotel by the week Vernal Utah; 7 night hotel rate Vernal; cheap weekly hotel Vernal |
| **Search intent** | Transactional — price comparison, ready to call |
| **Ideal visitor** | Individual booking 1–3 weeks, paying personally or on per diem |
| **Booking intent** | **High** — closest-to-conversion page in the cluster |
| **Internal links** | → Monthly (longer stay), → Extended Stay (what living here is like), → hub |
| **CTA** | Single, dominant: call to book, 10% direct discount, code ROCCO. No competing CTA above the fold |

| | |
|---|---|
| **Page** | `/monthly-hotel-rates-vernal-utah` **(NEW)** |
| **Primary keyword** | monthly hotel rates Vernal Utah |
| **Secondary** | monthly hotels Vernal Utah; hotel by the month Vernal; month to month lodging Vernal UT; 30 day hotel stay Vernal |
| **Search intent** | Transactional — price, with a strong "is this even possible" component |
| **Ideal visitor** | 1–6 month assignment; relocating; between housing |
| **Booking intent** | **High** |
| **Internal links** | → Weekly (shorter stay), → Extended Stay, → `/business/direct-billing`, → hub |
| **CTA** | Call for a confirmed monthly quote. Secondary: corporate account request if company-paid |
| **Note** | Ranks ~10 today with no page and no published price. See §5. |

| | |
|---|---|
| **Page** | `/extended-stay-hotel-vernal-utah` |
| **Primary keyword** | extended stay hotel Vernal Utah |
| **Secondary** | long term hotel Vernal Utah; extended stay Vernal UT; hotel with kitchen Vernal Utah; long stay lodging Uinta Basin |
| **Search intent** | Commercial investigation — "can I actually live there for two months?" |
| **Ideal visitor** | Anyone weighing a hotel against a short-term rental or apartment |
| **Booking intent** | Medium |
| **Internal links** | → Weekly, → Monthly (both for price — this page carries none), → Workforce Housing, → 1 destination page |
| **CTA** | Soft, mid-page and end: "Questions about a long stay? Call the front desk." This page persuades; the rate pages close |
| **Refocus** | **Currently a rate page. Becomes the lived-experience page** — kitchenette inventory, laundry, housekeeping cadence, mail and packages, groceries, what a Tuesday looks like. Zero rate tables. |

### Tier 2 — Operations

| | |
|---|---|
| **Page** | `/workforce-housing-vernal-utah` |
| **Primary keyword** | workforce housing Vernal Utah |
| **Secondary** | crew lodging Vernal Utah; crew housing Uinta Basin; contractor housing Vernal UT; company hotel rooms Vernal |
| **Search intent** | Commercial — B2B, sourcing for others |
| **Ideal visitor** | **Books rooms they will not sleep in** — coordinator, scheduler, office manager, foreman |
| **Booking intent** | High, but a *process* not a click — this buyer needs a quote and terms |
| **Internal links** | → `/business/room-blocks`, → `/business/direct-billing`, → Oilfield Housing, → Monthly, → hub |
| **CTA** | "Request a crew quote" (form, `kind: crew_block`) as primary; phone secondary. The only page where the form outranks the phone |
| **Refocus** | Currently written to the worker. **Rewrite to the coordinator** — headcount, rotation scheduling, billing, single invoice, rooming lists, change/cancellation windows |

| | |
|---|---|
| **Page** | `/oilfield-housing-vernal` |
| **Primary keyword** | oilfield housing Vernal Utah |
| **Secondary** | oilfield lodging Uinta Basin; man camp alternative Vernal; rig crew hotel Vernal Utah; oil field worker housing Vernal UT |
| **Search intent** | Commercial — industry-qualified, logistics-driven |
| **Ideal visitor** | The worker or crew lead choosing where the crew sleeps |
| **Booking intent** | High |
| **Internal links** | → Workforce Housing, → Weekly, → `/business/direct-billing`, → 1–2 destination pages (days off) |
| **CTA** | Call — this buyer calls, they do not fill in forms |
| **Status** | **Already the strongest page in the cluster** (288 lines, genuinely unique H2s: "The Uinta Basin Energy Landscape", "Better Than a Man Camp"). Keep, deepen with drive times to field areas |

### Tier 2 — Qualified Audience

| | |
|---|---|
| **Page** | `/government-per-diem-lodging-vernal` **(NEW — gated)** |
| **Primary keyword** | government per diem hotel Vernal Utah |
| **Secondary** | GSA per diem lodging Vernal UT; government rate hotel Vernal; BLM contractor lodging Vernal; tax exempt hotel Utah government |
| **Search intent** | Transactional + compliance |
| **Ideal visitor** | Federal/state employee or agency contractor who must stay within per diem and file correctly |
| **Booking intent** | **High** — this visitor is booking, they are checking compliance |
| **Internal links** | → `/business/tax-exempt-stays`, → `/business/documents`, → Weekly, → hub |
| **CTA** | Call, plus a direct link to the tax-exemption requirements |
| **Gate** | Does not ship until GSA rate handling and Utah exemption procedure are confirmed. See §10 |

| | |
|---|---|
| **Page** | `/travel-nurse-housing-vernal-utah` **(NEW — conditional)** |
| **Primary keyword** | travel nurse housing Vernal Utah |
| **Secondary** | travel nurse lodging Vernal UT; 13 week housing Vernal Utah; hotel near Ashley Regional Medical Center |
| **Search intent** | Commercial investigation |
| **Ideal visitor** | Contract clinician on a 13-week assignment with a housing stipend |
| **Booking intent** | Medium–High |
| **Internal links** | → Monthly, → Extended Stay, → hub |
| **CTA** | Call for a contract-length quote |
| **Gate** | **Ships only if the hotel can state something real about 13-week terms.** Otherwise it is a job-title doorway page and becomes a segment on Extended Stay instead |

### Tier 3 — Procurement Center

| Page | Primary keyword | Intent | Visitor | Booking intent | CTA |
|---|---|---|---|---|---|
| `/business/` | corporate hotel account Vernal Utah | Navigational / transactional | Any company buyer | Medium (routes) | Route to the right form |
| `/business/direct-billing` | hotel direct billing Vernal Utah | **Transactional** | AP clerk, coordinator | **Transactional** | "Apply for direct billing" |
| `/business/corporate-accounts` | corporate hotel account Utah | **Transactional** | Office manager, procurement | **Transactional** | "Open a corporate account" |
| `/business/tax-exempt-stays` | tax exempt hotel stay Utah | Informational → transactional | Government, nonprofit, some contractors | High | "See what to bring" + call |
| `/business/documents` | hotel W-9 form; hotel certificate of insurance | **Transactional** | AP / vendor onboarding | **Transactional** | Direct download; no gate |
| `/business/room-blocks` | hotel room block Vernal Utah | **Transactional** | Coordinator, PM | **Transactional** | "Request a block" |
| `/business/corporate-rates` | negotiated corporate hotel rate Vernal | **Transactional** | Procurement | **Transactional** | Existing form |

**No two primary intents repeat across all 15 pages.**

---

## 5. Monthly Rate Strategy

### 5.1 The problem, stated precisely

The site ranks ~position 10 for "monthly hotels vernal utah" and publishes no monthly price, no monthly page, and no monthly booking path. `RATES.monthly` is `null` across every room type. Four pages say "call for monthly pricing," which loses every visitor who wanted to compare before calling — and comparison is exactly what a monthly-rate searcher is doing.

The reason it is unpublished is legitimate: monthly rates vary with occupancy, and Vernal has real seasonality. Management will not commit to a fixed number it may not honor in July. Publishing a number the front desk won't honor is the same failure the rate-centralization work was done to prevent.

### 5.2 Recommendation: published floor with visible conditions

Do not publish a fixed monthly price. Do not publish nothing. **Publish a floor that is always honorable, and show the conditions that produce it.**

```
Monthly Rates — Standard Queen

  From $X,XXX for 28 nights          ← the floor
  ≈ $XX per night                     ← derived, never stored
  + tax

  Rates effective July 2026. Based on availability.
  Final rate confirmed when you book — call (435) 789-6625.
```

**Why this is honest and not a bait price:**

1. **The floor is set at the highest-season monthly rate**, not the lowest. A "from" price is deceptive when the advertised number is achievable only in rare conditions. Set at peak, the published number is one the front desk can honor in *any* month — it is a ceiling wearing a floor's clothes. This is the single decision that makes the whole approach non-deceptive.
2. **An effective date is shown.** "Rates effective July 2026" tells the visitor the number's age, gives management a natural revision cadence, and is a freshness signal.
3. **The condition is adjacent to the number**, not in a footnote — same visual block, same weight.
4. **No strikethrough, no fake anchor.** Never render "~~$2,400~~ $1,900". There is no former price; inventing one is the deceptive pattern to avoid.
5. **Availability-based, and it says so.** A monthly stay genuinely depends on inventory.

### 5.3 Show the arithmetic

The monthly page's real value is doing the math the visitor would otherwise do wrong:

| Booking method | 28 nights, Standard Queen | Effective per night |
|---|---|---|
| Nightly rate × 28 | OWNER REVIEW REQUIRED | — |
| Weekly rate × 4 | $2,352 (4 × $588) | $84 |
| **Monthly rate** | **OWNER REVIEW REQUIRED** | **OWNER REVIEW REQUIRED** |

Weekly-×-4 is computed from `RATES.weekly.standardQueen`, so it can never drift. This table alone justifies the page: it shows the monthly discount is real, in the visitor's own numbers, without a marketing claim.

### 5.4 Implementation

`src/data/rates.ts` already has the right design — the `null`-means-unpublished gate and the `hasMonthlyRates` flag. Extend, do not redesign:

```ts
monthly: {
  standardQueen: null as number | null,
  doubleQueen:   null as number | null,
  standardKing:  null as number | null,
  jacuzziSuite:  null as number | null,
  nights:        null as number | null,   // 28 or 30 — needed for honest per-night math

  /** Peak-season floor. Published as "from". Must be honorable in ANY month. */
  floorStandardQueen: null as number | null,
  /** "July 2026" — rendered next to every monthly number. */
  effectiveDate:      null as string | null,
  /** Rendered verbatim beside the price. Never paraphrase in a page. */
  conditions:         null as string | null,
},
```

Rules:

- **The monthly page ships before the rates are confirmed.** It renders "Call for monthly pricing," the weekly-×-4 comparison, and the full how-monthly-billing-works content. That content is valuable without a price, and it starts earning position immediately. The number is a one-line edit later.
- **Gate the price UI on `hasMonthlyRates`,** which already exists.
- **Never emit `Offer` schema for a `null` rate.** Structured data claiming an unavailable price is a live spam risk. See §7.
- **Never publish a monthly rate without `effectiveDate`.** Make it a build-time assertion in `verify-destination-pages.mjs`: if any monthly rate is non-null and `effectiveDate` is null, fail the build.

### 5.5 Related pricing defects found

- **`/weekly-hotel-rates-vernal-utah` omits the Standard King.** The homepage publishes it at $700/week in the rate card, rate table, and a JSON-LD `Offer`. The page that actually ranks for rate queries does not list the room type at all. One-line fix, no owner input needed — **do this first**.
- **Jacuzzi Suite has no published weekly rate** (`null`) and no page, while appearing on seven pages as an amenity. OWNER REVIEW.
- **Contradiction between pages:** extended-stay says "free laundry"; weekly-rates says "on-site laundry facilities." Free or coin-operated? OWNER REVIEW — this is the kind of mismatch the front desk pays for.

---

## 6. Entity Strategy

### 6.1 The rule, derived from the Ashley failure

The Ashley page failed because its copy could have described any national forest. Google could not bind it to a specific entity, so it matched it against all of them — 91 out-of-market queries, 466 impressions, zero clicks.

> **An entity earns a mention only when it carries a fact that changes the reader's decision.**

Distance, drive time, what it means for the stay, why it matters at 5 a.m. A mention with no attached fact is keyword stuffing, and it actively harms disambiguation.

### 6.2 The entity graph

```
                        Best Western Vernal Inn
                     (1935 S 1500 E, Vernal, UT 84078)
                                  │ located in
                                  ▼
                               VERNAL ─── seat of ──► UINTAH COUNTY
                                  │                    (tax jurisdiction,
                                  │                     GSA per diem locality)
                    ┌─────────────┼─────────────┐
        within      │             │             │      adjacent to
            ▼       ▼             ▼             ▼            ▼
      UINTA BASIN            VERNAL          US-40 /    RECREATION
    (geologic play,        REGIONAL         US-191      ├── Dinosaur Nat'l Mon. (20 mi)
     where the work is)    AIRPORT (VEL)    corridors   ├── Flaming Gorge (40 mi)
            │               (0.6 mi)            │       ├── Ashley Nat'l Forest (15 mi)
            ▼                                   ▼       └── Red Fleet State Park (12 mi)
     field areas,                        drive times
     drilling operations                 to job sites
```

### 6.3 Edge ownership — how repetition is avoided

Each page owns a **different edge** of the graph. No page describes the whole graph.

| Page | Edge it owns | Entities it may use | Entities it must not |
|---|---|---|---|
| Weekly Rates | Hotel → Vernal (price context) | Vernal, Uintah County (tax) | Recreation, field areas |
| Monthly Rates | Hotel → Vernal (long-stay context) | Vernal, Uintah County | Recreation, field areas |
| Extended Stay | Hotel → Vernal (daily life) | Vernal, local services | Uinta Basin, field areas |
| Workforce Housing | Hotel → VEL Airport (crew rotation) | VEL, Vernal, Uintah County | Recreation |
| Oilfield Housing | Hotel → Uinta Basin (field access) | Uinta Basin, US-40/191, field areas | Recreation except days-off block |
| Government/Per Diem | Hotel → Uintah County (jurisdiction) | Uintah County, GSA locality, BLM | Recreation, field areas |
| Travel Nurse | Hotel → Ashley Regional Medical Center | ARMC, Vernal | Uinta Basin, field areas |
| `/business/*` | Hotel → the company | Vernal, Uintah County only | Everything else |

The **"On Your Days Off"** block is the single sanctioned exception, and it appears **once per page, near the end, with 2–3 links**. A crew on a 14-day hitch genuinely has days off — that is a real reason to mention Flaming Gorge, and it is why the mention won't read as stuffing.

### 6.4 The Uinta / Uintah distinction

Both spellings are correct and they mean different things. Using them interchangeably is an entity-disambiguation error of exactly the kind that sank the Ashley page.

- **Uinta Basin** — the geologic/petroleum province. Correct for the oil and gas play, field operations, and the energy industry. Use on Oilfield Housing.
- **Uintah County** — the political and tax jurisdiction. Correct for per diem localities, tax exemption, and county services. Use on Government/Per Diem and `/business/tax-exempt-stays`.
- **Uintah Basin** — regional/colloquial usage, common locally for the community and economic region.

**Recommendation:** "Uinta Basin" for the geologic and energy context, "Uintah County" for anything jurisdictional, and "Uintah Basin" only where quoting local institutional usage. Apply consistently and note it in the page standard. *(OWNER REVIEW: confirm the hotel's preferred house usage — locals have strong habits here and matching them matters more than matching USGS.)*

### 6.5 Structural reinforcement

Entity signals should come from structure, not repetition:

- One `Hotel` node with a stable `@id`, referenced everywhere (§7) — the strongest disambiguation available
- `BreadcrumbList` on every page, communicating silo position
- Consistent NAP from `BUSINESS` (already enforced by `src/data/business.ts`)
- `geo` coordinates on the Hotel node
- Distances stated as facts with units, not adjectives — "0.6 miles from Vernal Regional Airport", never "conveniently located near the airport"

**Ban list, cluster-wide:** "conveniently located", "nestled in the heart of", "gateway to", "premier destination", "whether you're... or...". Every one of these is a mention without a fact.

---

## 7. Schema Plan

### 7.1 The most important change: one Hotel node, referenced everywhere

Currently, LodgingBusiness/Hotel data is re-declared per page. For a single-property site this creates many competing entity nodes and is a real contributor to the disambiguation weakness already diagnosed.

**Declare the hotel once, with a stable `@id`, and reference it from every other page.**

```jsonc
// Emitted once, on the homepage:
{
  "@context": "https://schema.org",
  "@type": "Hotel",
  "@id": "https://bestwesternvernalinn.com/#hotel",
  "name": "Best Western Vernal Inn",
  "address": { "@type": "PostalAddress", "...": "from BUSINESS.address" },
  "geo": { "@type": "GeoCoordinates", "latitude": 40.4474, "longitude": -109.5194 },
  "telephone": "+14357896625",
  "checkinTime": "15:00",
  "checkoutTime": "11:00",
  "petsAllowed": true,
  "amenityFeature": [ /* only confirmed amenities */ ]
}

// Every other page references it — no re-declaration:
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://bestwesternvernalinn.com/monthly-hotel-rates-vernal-utah#webpage",
  "about": { "@id": "https://bestwesternvernalinn.com/#hotel" },
  "isPartOf": { "@id": "https://bestwesternvernalinn.com/#website" }
}
```

`Hotel` is the correct type — it is a subtype of `LodgingBusiness`, which is a subtype of `LocalBusiness`. Emitting all three is redundant; emit `Hotel` only.

### 7.2 Per-page schema

| Page | Schema | Why |
|---|---|---|
| Homepage | `Hotel` (canonical `@id`) + `Organization` + `WebSite` + `BreadcrumbList` | Single entity definition for the whole site |
| Hub | `WebPage` + `BreadcrumbList` + `about` → Hotel | Orientation page; no offers of its own |
| Weekly Rates | `WebPage` + `BreadcrumbList` + `Hotel` ref + **`Offer` per published rate** | Only page with confirmed weekly prices |
| Monthly Rates | Same, **`Offer` only when non-null** | Gate on `hasMonthlyRates` |
| Extended Stay | `WebPage` + `BreadcrumbList` + Hotel ref. **No Offer** | Carries no prices by design (§2.3) |
| Workforce Housing | `WebPage` + `BreadcrumbList` + Hotel ref | No prices |
| Oilfield Housing | `WebPage` + `BreadcrumbList` + Hotel ref + `Place` for Uinta Basin | `Place` disambiguates the basin |
| Government/Per Diem | `WebPage` + `BreadcrumbList` + Hotel ref | Compliance content, no offers |
| Travel Nurse | `WebPage` + `BreadcrumbList` + Hotel ref | — |
| `/business/` hub | `WebPage` + `BreadcrumbList` + `ContactPoint` (`contactType: "billing support"`) | Named procurement contact route |
| `/business/direct-billing` | `WebPage` + `BreadcrumbList` + `HowTo` | Application genuinely is a stepped process |
| `/business/corporate-accounts` | `WebPage` + `BreadcrumbList` + `HowTo` | Same |
| `/business/tax-exempt-stays` | `WebPage` + `BreadcrumbList` + `HowTo` | Requirements are procedural |
| `/business/documents` | `WebPage` + `BreadcrumbList` + `DigitalDocument` per file | Correct type for W-9/COI |
| `/business/room-blocks` | `WebPage` + `BreadcrumbList` | — |
| `/business/corporate-rates` | `WebPage`, `noindex` | Form endpoint |
| FAQ | `WebPage` + `BreadcrumbList` + `FAQPage` | See below |

### 7.3 Offer, correctly

```jsonc
{
  "@type": "Offer",
  "name": "Standard Queen — Weekly Rate",
  "price": "588",
  "priceCurrency": "USD",
  "priceValidUntil": "2026-12-31",          // must be real
  "availability": "https://schema.org/InStock",
  "priceSpecification": {
    "@type": "UnitPriceSpecification",
    "price": "588",
    "priceCurrency": "USD",
    "referenceQuantity": {
      "@type": "QuantitativeValue",
      "value": 7,
      "unitCode": "DAY"
    },
    "valueAddedTaxIncluded": false            // rates are quoted "+ tax"
  }
}
```

Hard rules:

- **No `Offer` for a `null` rate.** Derive the block from `RATES`; never hand-write it.
- **`valueAddedTaxIncluded: false`** — every published rate is pre-tax, and the markup must say so.
- **`priceValidUntil` must be a real date**, tied to `effectiveDate`.
- **`Offer` only on the two rate pages**, matching §2.3.
- **Never emit `aggregateRating` without a real, verifiable review count.** Fabricated ratings are a manual-action risk. If real ratings exist, they must come from a system of record. *(OWNER REVIEW: is there a review source to wire in?)*

### 7.4 FAQPage — a correction to the brief

The brief asks for FAQPage "only if eligible." **No page on this site is eligible for FAQ rich results.** Google restricted FAQ rich results to authoritative government and health sites in August 2023. A hotel will not get the SERP feature regardless of markup quality.

FAQPage markup is still worth keeping where the FAQ is genuinely the page's main content — it aids extraction into AI overviews and assistant answers. But:

- Keep it on `/faq` and on pages where the FAQ is the substance.
- **Remove it** from pages where the FAQ is a four-question appendix — currently the pattern on the three template pages. It adds weight and signals nothing.
- Never mark up questions that are not visible on the page.

### 7.5 Validation

Add to `scripts/verify-destination-pages.mjs`:

1. Exactly one `Hotel` node with `@id` `#hotel` across the built site.
2. No page emits `Offer` for a price absent from `RATES`.
3. Every page in the commercial silo emits `BreadcrumbList`.
4. No `aggregateRating` anywhere until a review source is wired.
5. Every FAQPage question string appears in the rendered HTML.

---

## 8. Internal Linking Plan

### 8.1 The current problem

Every commercial page ends with the same ~16-link "Plan Your Stay" mesh in a bordered box: By Stay Type, By Destination, Plan Your Visit. It is identical across pages.

Three problems:

1. **It is a footer nav, not editorial linking.** Boilerplate blocks repeated site-wide carry heavily discounted weight.
2. **It passes no topical signal.** When every page links to every page, the link graph says nothing about which pages relate.
3. **It makes pages look alike.** On a 171-line page, ~45 lines are this identical block — a direct contributor to the template-clone problem.

### 8.2 Replacement topology

```
                         Homepage
                         /      \
                        /        \
        /corporate-lodging-vernal-utah ──► /business/
             (HUB)          │                (HUB)
        ┌──────┬────────────┼──────────┐        │
        ▼      ▼            ▼          ▼        ▼
     Weekly  Monthly   Extended    Workforce  6 procurement
        │      │        Stay          │        pages
        └──┬───┘          │           │          │
           │              │           ▼          │
           └──────────────┴────► Oilfield ◄──────┘
                                     │
                                     ▼
                          Destination pages (days off only)
```

Rules:

1. **Every spoke links up to its hub, once, in prose, high on the page.**
2. **Every hub links down to every spoke** with descriptive anchors, in the main content.
3. **Spokes link sideways to 2–3 genuine siblings only** — never all of them. Weekly ↔ Monthly (adjacent durations). Workforce ↔ Oilfield (adjacent operations). Extended Stay → both rate pages.
4. **3–6 contextual in-body links per page**, in sentences, where the link answers the question just raised. *"Direct billing is available for company-paid stays — see how to set up an account →"* beats a link list.
5. **One "On Your Days Off" block per page**, 2–3 destination links, near the end.
6. **The big mesh is removed from commercial pages.** If a link module is wanted, reduce it to a 5-link "By Stay Type" list. Keep the full mesh on destination pages where it does less harm.
7. **Vary anchor text.** "weekly rates", "what a week costs", "7-night pricing" — all pointing at the same URL. Identical anchors site-wide are a footprint.

### 8.3 Authority routing

- **Homepage** holds the most authority (81% of clicks). It must link to both hubs in body content, not just nav — that is the main authority injection into the cluster.
- **The two rate pages are the conversion targets** and should receive the most internal links. Every commercial page links to at least one.
- **Procurement pages will earn few external links.** They depend almost entirely on internal authority — hence the `/business/` hub and a link to it from every operations page.
- **Oilfield Housing is the strongest cluster page** and should link *out* generously to weaker siblings.

### 8.4 Breadcrumbs

`src/components/Breadcrumbs.astro` exists. Apply it across the commercial silo — it is how flat URLs communicate hierarchy:

```
Home → Corporate Lodging → Weekly Hotel Rates
Home → Corporate Lodging → Business Services → Direct Billing
```

---

## 9. Conversion Plan

*No popups, no interstitials, no exit-intent overlays — per constraints, and because this audience is hostile to them.*

### 9.1 The measurement gap that matters most

The site's primary conversion is a phone call. GA4 tracks the **`tel:` click**, not the call, not the booking. Right now there is no way to know whether the commercial cluster produces revenue.

Two fixes, in order of cost:

1. **Free, immediate: ask at the desk.** The front desk asks every caller "How did you find us?" and whether they have a code, and logs it. This validates the ROCCO promo, attributes bookings to pages, and costs nothing but a habit. Do this regardless of what else happens.
2. **Paid, higher fidelity: a call-tracking number.** A separate DID forwarding to the front desk, displayed only on commercial pages, would give true call attribution. *(OWNER REVIEW: is management willing to display a number other than (435) 789-6625 on some pages? NAP consistency must be preserved — the tracking number must never enter schema, the footer, or the GBP listing.)*

Without one of these, every conversion claim in this plan is unverifiable. Say so plainly rather than reporting `tel:` clicks as bookings.

### 9.2 Phone CTAs

- **The 24-hour front desk is a real competitive advantage and the CTA should say so.** "Call any time — 24-hour front desk" removes the "is it too late to call?" hesitation, which is a genuine blocker for shift workers at 11 p.m. Most competitors cannot make this claim.
- **The promo code is friction on a phone call.** Asking someone to remember "ROCCO" while dialing loses codes. Recommend: (a) the code appears immediately adjacent to the number, never in a separate block; (b) the front desk applies the direct discount whether or not the caller says the code, and the code is used for *attribution*, not qualification. A guest who forgot the code and gets charged more is the unhonored-claim failure mode the rate work exists to prevent.
- **One primary CTA per page.** The rate pages currently show three near-identical call buttons in the footer CTA (Call Directly / Email / Book Direct & Save) — all `tel:` except email. Collapse to one prominent call action plus one secondary.
- **Sticky bar should be page-aware.** `StickyBookingBar.astro` should carry "Call to book" on rate pages and "Request a corporate account" on procurement pages.

### 9.3 Corporate inquiry forms

`src/islands/CorporateRateForm.tsx` already has the right architecture: a `kind` discriminator, Supabase insert with a `mailto` fallback, and GA4 success/error events distinguishable from click attempts. **Extend it; do not build new forms.**

Add `kind` values: `direct_billing`, `tax_exempt`, `crew_block`, `corporate_account`, `long_term_project`. Same island, different entry points, different default fields.

Add fields for procurement reality:
- Estimated room-nights (the number that determines whether a negotiated rate is possible)
- Project start and expected duration
- Billing method (company card / direct bill / PO)
- PO or cost-center number (optional)
- Whether a COI is required

**State a response time only if it is real.** *(OWNER REVIEW: what response time can the front desk actually commit to? "Same business day" is worth far more than "we'll get back to you" — but only if true.)*

### 9.4 Trust signals

Order by what this audience actually trusts:

1. **Specific policies stated plainly.** "Check-in 3 p.m., check-out 11 a.m., 24-hour front desk, trucks and trailers park free" outperforms any badge with this audience.
2. **The Best Western brand mark.** *(OWNER REVIEW: confirm brand usage rights and current placement compliance.)*
3. **Real ratings, if a source exists.** Never invented. Never in schema without a verifiable count.
4. **A named contact for procurement.** "Ask for [name]" converts far better than "contact us." *(OWNER REVIEW: who owns corporate accounts?)*
5. **Rate effective dates.** "Rates effective July 2026" signals a maintained site.

Avoid generic badge clip-art ("100% Secure", "Best Price"). The `best-rate` and `flex-cancel` entries in `BUSINESS.bookDirect` are `confirmed: false` and **must not be displayed** until signed off — the existing gate is correct and should not be bypassed for conversion reasons.

### 9.5 Friction removals

- **W-9 and COI must download without a form.** Gating them behind a lead capture is the single most common procurement-site mistake. An AP clerk who cannot get a W-9 in ten seconds calls a competitor.
- **Publish the billing email and a direct extension** on `/business/`, not just a form.
- **State what to bring for tax exemption before arrival**, not at check-in — a guest turned away at the desk for a missing form is a lost repeat account.
- **Make the phone number tappable everywhere** including inside prose. Verify all `tel:` links use `BUSINESS.phoneTel`.

---

## 10. Procurement Center Design

### 10.1 Design principle

> A procurement officer should be able to onboard this hotel as a vendor without speaking to anyone.

Every page removes one blocker between a company and a booked room.

### 10.2 `/business/` — hub

**Purpose:** route a company buyer to the right process in one click.
**Visitor:** office manager, AP clerk, procurement officer, coordinator.
**Structure:** three lanes — *Set up an account* (corporate accounts, direct billing), *Get documents* (W-9, COI, ACH), *Book rooms* (room blocks, corporate rates).
**Must include:** a named procurement contact, a direct email, a phone extension, and a stated response time. *(All four OWNER REVIEW.)*
**Schema:** `WebPage` + `BreadcrumbList` + `ContactPoint`.

### 10.3 `/business/direct-billing`

**Purpose:** let a company have the hotel invoice it instead of employees paying and expensing.
**Why it matters:** the single largest friction point in corporate lodging. A crew of eight filing individual expense reports is a reason to switch hotels.
**Questions to answer:** Who qualifies? What is the application and how long does it take? What are the payment terms — net 15/30? What is the credit limit? What goes on the invoice? Can it be split by cost center or project? What happens with incidentals? What if an employee no-shows?
**Content requirement:** the actual application steps, the actual terms. *(All OWNER REVIEW — nothing here can be inferred.)*
**Schema:** `WebPage` + `BreadcrumbList` + `HowTo`.
**CTA:** "Apply for direct billing" → form, `kind: direct_billing`.

### 10.4 `/business/corporate-accounts`

**Purpose:** establish an ongoing relationship — negotiated rate, billing terms, named contact.
**Distinct from direct billing:** direct billing is *how you pay*; a corporate account is *the relationship*, including rate. Separate pages because a company often wants one without the other.
**Questions:** What is the room-night threshold for a negotiated rate? What does the application require? How long does approval take? Is the rate guaranteed for a term? Does it apply during peak season? Who is the account contact?
*(All OWNER REVIEW.)*
**Schema:** `WebPage` + `BreadcrumbList` + `HowTo`.

### 10.5 `/business/tax-exempt-stays`

**Purpose:** let exempt organizations avoid tax correctly, in advance.
**Visitor:** government employees, nonprofits, some contractors.
**Questions:** Who qualifies under Utah law? Which form is required, and is it the state exemption certificate? Must payment come directly from the organization? What if an employee pays personally? What must be presented at check-in? Can tax be refunded after the fact? Are county/local transient room taxes treated differently from state sales tax?
**Critical constraint:** tax law is regulatory. **Do not paraphrase Utah State Tax Commission rules into confident prose.** State the hotel's *procedure* — what to bring, who to notify, when — and link to the authoritative source for the rules themselves. *(Procedure: OWNER REVIEW. Regulatory citations: must link to official Utah State Tax Commission guidance, never be summarized from memory.)*
**Schema:** `WebPage` + `BreadcrumbList` + `HowTo`.

### 10.6 `/business/documents`

**Purpose:** every document a vendor-onboarding process needs, on one page, ungated.
**Contents:** W-9, Certificate of Insurance (and how to request one naming the client as certificate holder), ACH/remittance details, business license if requested, the hotel's legal entity name and EIN-bearing document.
**Why one page, not four:** a W-9 page is a download link and 80 words. Three such pages are thin content competing with each other. One page is a genuinely useful resource and ranks better for all of them.
**Hard rule:** **no email gate.** Direct download.
**Schema:** `WebPage` + `BreadcrumbList` + `DigitalDocument` per file.
*(OWNER REVIEW: all documents must be supplied. Confirm the correct legal entity name — `BUSINESS.name` is "Best Western Vernal Inn", the management partner is listed as MSC Companies, and the booking engine URL references "executiveinnsuites". The legal entity on a W-9 may differ from the trade name, and getting this wrong breaks vendor onboarding.)*

### 10.7 `/business/room-blocks`

**Purpose:** book multiple rooms for a crew or project.
**Absorbs:** Company Reservations, Long-Term Projects, Group Blocks.
**Questions:** How many rooms make a block? How far ahead? When is the rooming list due? What is the cancellation/attrition window? Can rooms be added mid-project? Is one invoice possible? What about rotating crews — same block, different names? Deposit required?
*(All OWNER REVIEW.)*
**Schema:** `WebPage` + `BreadcrumbList`.
**CTA:** "Request a room block" → form, `kind: crew_block`.

### 10.8 `/business/corporate-rates`

Existing form, moved from `/corporate-rates` (301). Stays `noindex` — it is a form endpoint, and `/business/corporate-accounts` is the indexable page that feeds it.

### 10.9 Owner Review Packet → superseded by the Business Knowledge Workbook

**This is the critical path.** Nine pages are blocked on facts only management holds.

These questions now live in **`docs/BUSINESS_KNOWLEDGE_WORKBOOK.md`**, which supersedes this section. The workbook is an operating document owned by the business rather than an SEO checklist: it covers property identity, rates, corporate travel, procurement, front-desk knowledge, oilfield knowledge, and attraction review sheets, with a confidence level and a visibility level recorded beside every answer.

The 20 questions blocking website work are the **fast path** at the top of that document. The list below is retained as a summary of what the commercial cluster specifically depends on.

**Pricing**
1. Are $588 / $660 / $700 weekly rates current?
2. Jacuzzi Suite weekly rate?
3. Monthly rates by room type — and 28 or 30 nights?
4. Peak-season monthly floor that can be honored in any month?
5. Nightly rack rate, for the monthly comparison table?
6. Effective date to publish alongside rates?

**Policies**
7. Laundry — free or coin-operated? (Pages currently contradict each other.)
8. Pet fee — exact amount and per-stay/per-night?
9. Cancellation policy? (`flex-cancel` is `confirmed: false`.)
10. Best-rate guarantee — real? (`best-rate` is `confirmed: false`.)
11. Kitchenette rooms — how many, guaranteed or on request, exact inventory?
12. Housekeeping cadence on weekly/monthly stays?
13. Mail and package handling for long-stay guests?

**Procurement**
14. Direct billing — qualification, application, payment terms, credit limit?
15. Corporate account — room-night threshold, approval time, rate term?
16. W-9 — and the correct legal entity name?
17. COI — process and turnaround?
18. Tax exemption — procedure and forms required at check-in?
19. Room blocks — minimum, rooming-list deadline, attrition window, deposit?
20. Named procurement contact, email, extension, committed response time?

**Government / per diem**
21. Is a GSA per diem rate offered, and does it track the Uintah County locality rate?
22. Is a government rate available to agency contractors, or employees only?

**Travel nurse (gate)**
23. Anything real to say about 13-week terms? If no, the page is not built.

**Measurement**
24. Willing to use a call-tracking number on commercial pages?
25. Will the front desk log "how did you hear about us" and code mentions?

**Brand**
26. Best Western brand mark usage rights confirmed?
27. Is there a review source for real ratings?

---

## 11. Implementation Roadmap

### Immediate (this week) — zero owner input required

1. **Deliver the Business Knowledge Workbook** (`docs/BUSINESS_KNOWLEDGE_WORKBOOK.md`, fast path first). Nothing else unblocks nine pages.
2. **Add the Standard King row to `/weekly-hotel-rates-vernal-utah`.** The homepage publishes $700/week; the ranking rate page omits the room type. One line.
3. **De-duplicate the three clone pages.** No new facts needed — remove the rate table from Extended Stay and Workforce Housing, remove the shared amenity list from two of three, reduce the 16-link mesh to a 5-link stay-type list. This alone resolves most of the cannibalization.
4. **Add `Breadcrumbs.astro` across the commercial silo.**
5. **Consolidate the `Hotel` schema node** to a single `@id` (§7.1); convert other pages to references.
6. **Remove `FAQPage` markup** from pages where the FAQ is a four-question appendix (§7.4).
7. **Fix the laundry contradiction** — pick one wording pending owner confirmation, and flag it.

### 30 days — needs pricing + basic procurement facts

8. **Build `/monthly-hotel-rates-vernal-utah`.** Ship with "call for pricing" if rates are not yet confirmed; the comparison table and billing content are valuable without a number. Highest-value single page in the plan.
9. **Extend `rates.ts`** with `floorStandardQueen`, `effectiveDate`, `conditions`; add the build-time assertion (§5.4).
10. **Build the `/corporate-lodging-vernal-utah` hub** and wire homepage body links to it.
11. **Build `/business/` + `/business/documents`** — documents ships the moment W-9 and COI exist and is the fastest procurement win.
12. **Rewrite `/extended-stay-hotel-vernal-utah`** to lived-experience. Rates removed.
13. **Rewrite `/workforce-housing-vernal-utah`** to address the coordinator, not the worker.
14. **Extend `CorporateRateForm`** with new `kind` values and procurement fields.
15. **Rebuild internal linking** to the topology in §8.2.

### 90 days — needs full procurement facts

16. `/business/direct-billing`, `/business/corporate-accounts`, `/business/room-blocks`
17. `/business/tax-exempt-stays` — with authoritative links, not paraphrased regulation
18. `/government-per-diem-lodging-vernal` — gated on Q21–22
19. **Deepen `/oilfield-housing-vernal`** with drive times to field areas *(OWNER REVIEW: drive times must be measured, never estimated)*
20. **Extend `verify-destination-pages.mjs`** with the §7.5 schema checks and the §2.3 rate-table rule
21. **Publish monthly rates** if confirmed; add `Offer` blocks
22. **Front-desk attribution habit** live and reporting

### Future — conditional

23. `/travel-nurse-housing-vernal-utah` — only if Q23 yields real content
24. **Jacuzzi Suites page** — leisure intent, not commercial; belongs to a separate cluster, but the null weekly rate should be resolved regardless
25. **Employer landing-page template** — one page per *signed* corporate relationship, with real project and rate facts. This is the honest answer to "scalable for future industries and employers": the unit is the relationship, not the job title. No page ships without an agreement.
26. **Seasonal rate handling** if Vernal seasonality proves large enough to need it

### Sequencing rationale

Items 1–7 need no owner input and remove the cannibalization that is suppressing the whole cluster — they are pure upside available this week. Item 8 attacks the largest measurable gap (a position-10 ranking with nothing to convert). The procurement center is deliberately last among the substantive builds despite being the strongest long-term differentiator, because it is the most fact-dependent and the least recoverable if fabricated.

**The one thing that would most change this timeline is the Owner Review Packet coming back fast.** Engineering is not the bottleneck and has not been since the rate centralization landed.

---

## Appendix A — Content Quality Standard

Inherits `docs/DESTINATION_PAGE_STANDARD.md`. Additional rules for commercial pages:

1. **Every page is useful to someone who never books here.** A page about direct billing should teach a coordinator how hotel direct billing works generally. That is the editorial standard and also why the page will rank.
2. **Decision support over description.** Not "spacious rooms" but "the kitchenette has a full-size refrigerator, so a week of groceries fits."
3. **Numbers with units.** Distances in miles, times in minutes, prices with "+ tax", durations in nights.
4. **Unverified facts use the marker.** Literal string `OWNER REVIEW REQUIRED`, visible in source, never rendered as fact to a visitor.
5. **Local experience stays gated.** `src/data/frontDeskInsights.ts` requires `reviewed` / `reviewedBy` / `reviewedOn`; `FrontDeskInsight.astro` renders nothing without a named sign-off. No commercial page bypasses this.
6. **No page ships with a duplicated section from a sibling.** Enforced in `verify-destination-pages.mjs`.

### Never fabricate

Pricing · policies · amenities · regulations · travel times · seasonal closures · business relationships · employer names · certifications · response times · GSA rates · tax rules · review ratings.

When unavailable: `OWNER REVIEW REQUIRED`, plus a note on who can answer it.

---

## Appendix B — Cannibalization Audit (evidence)

Measured 2026-07-31 from source.

| Page | Lines | H2 skeleton | Rate table | Amenity list | Mesh block |
|---|---|---|---|---|---|
| `weekly-hotel-rates-vernal-utah` | 171 | Breakdown / Included / FAQ / Find Room / Ready to Book | ✅ full | ✅ 7 items | ✅ 16 links |
| `extended-stay-hotel-vernal-utah` | 173 | Different / Who Stays / FAQ / Find Room / Ready to Book | ✅ prose | ✅ 7 items | ✅ 16 links |
| `workforce-housing-vernal-utah` | 174 | Why Crews / Industries / FAQ / Find Room / Ready to Book | ✅ prose | ✅ 7 items | ✅ 16 links |
| `oilfield-housing-vernal` | 288 | Energy Landscape / Man Camp / Billing / How to Book | ➖ partial | ✅ | ✅ 16 links |
| `corporate-rates` | 54 | — (`noindex`) | ➖ | ➖ | ➖ |

The first three share H2 positions 3, 4, and 5 exactly, and all three carry the same seven-item amenity list, the same "monthly rates available — call (435) 789-6625" line, and the same closing CTA triple. Roughly 45 of ~172 lines per page are the identical mesh block.

**Target state:** rate table on 2 pages, full amenity list on 1 page (Extended Stay, where it is the point), mesh reduced to 5 links, H2 skeletons fully distinct.
