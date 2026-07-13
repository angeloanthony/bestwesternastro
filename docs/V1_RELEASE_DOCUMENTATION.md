# Version 1.0 — Release Documentation

**Project:** AdventureOS — Best Western Vernal Referral & Booking Attribution Platform
**Status:** Version 1.0 — feature-complete, architecture frozen, offline-verified.
**Audience:** Future engineers and operators who may never have seen the development
history. This document is the permanent reference for the completed system: what it does,
where the code lives, how data moves through it, how it is tested, and how it is extended.

> **Scope of this document.** It describes the repository as it stands at V1.0. Live
> production certification and revenue activation depend on deployment steps and a business
> agreement that are deliberately **outside** the repository's scope (§7, §9, §11). Where a
> capability is built but gated on an external input, that is stated explicitly rather than
> implied to be finished.

---

## 1. Executive Summary

### 1.1 Purpose

The booking engine that actually takes a reservation (`theworld24.com` today) is **not
ours**. Once a visitor leaves our marketing site for that engine we get **no server-side
view of the conversion** — no pixel, no webhook, no order row. AdventureOS exists to solve
exactly one problem: **make every outbound booking click identifiable, then reconcile those
clicks against the partner's monthly report to learn which visitors actually booked and what
that is worth.** The strategy in one line: _identify on the way out, reconcile after the
fact._

### 1.2 Business goals

- Turn an anonymous "Book Now" click into a **tracked, attributable, commissionable** event.
- Produce a **defensible monthly reconciliation** — verified stays, attributed revenue, and
  commission — that a partner and an operator can both trust.
- Keep the public marketing site (SEO landing pages + conversion surface) fast, static, and
  **never dependent** on any of this machinery. A booking must never be blocked by our code.
- Remain **partner-type agnostic**: a hotel is only the first partner. Restaurants, museums,
  ATV outfitters, and rafting companies are the same shape — configuration, not new code.

### 1.3 Completed scope (what V1.0 delivers)

The seven subsystems that define the product (see §2), all built and offline-verified:

1. **Booking Gateway** — the `/go/[partner]` outbound interstitial that mints a referral code
   and records intent before handing off to the partner engine.
2. **Referral Attribution** — the referral-code / promo-code / name+date model that later ties
   a report line back to a specific click.
3. **Analytics** — the GA4 event funnel for calls, book-clicks, leads, and the referral flow.
4. **Corporate Leads** — the inbound corporate-rate / room-block form → database → email path.
5. **Partner Importer** — the off-browser CSV importer that normalizes any partner's monthly
   reservation report into a canonical, partner-agnostic shape.
6. **Reconciliation Engine** — the deterministic matcher that links imported report lines to
   booking intents and computes revenue and commission.
7. **Reporting** — the off-browser operational dashboard over recorded clicks.

Supporting foundation: a versioned Postgres schema with default-deny RLS (migrations
`001`–`010`), a lead-notification Cloudflare Worker, and a visual-regression + unit-test
guardrail suite.

### 1.4 Excluded scope (intentionally not part of the V1.0 mission)

Per [DESCOPE_PLAN.md](DESCOPE_PLAN.md), the referral-attribution mission explicitly **excludes**
the following. Some of this code is still present in the repository from an earlier product
direction and is a candidate for relocation to the sibling `adventureastro` project; it is
**not** part of the V1.0 booking platform and is not maintained as such here:

- **Adventure Pass** — passwordless member identity, saved adventures / favorites, the trip
  planner, and the member dashboard (`/pass`).
- **AI concierge / RAG** — no AI is in scope ([ADR-005](adr/ADR-005-ai-scope-limited-to-vernal.md)).
- **Knowledge graph** — the live location catalogue and its graph functions.
- Rewards, passports, and user profiles as product features.

The excluded member/graph code is **severable** and does not sit on the attribution path; the
one coupling seam (an optional, fail-open journey snapshot in the gateway) is documented in
[DESCOPE_PLAN.md §3](DESCOPE_PLAN.md).

---

## 2. System Overview

Each subsystem is described in business terms first, then its technical role.

### 2.1 Booking Gateway

**Business:** When a guest clicks "Book Now," we send them to the partner's booking engine —
but never with a raw link. We interpose a brief branded interstitial that shows the guest a
referral code and, silently, records that this visitor set out to book. If anything goes
wrong, the guest still reaches the booking engine; an unrecorded click must never cost a
booking.

**Technical:** `/go/[partner]` is one **prerendered, `noindex`** Astro page per partner
(`getStaticPaths` over the partner slugs — no SSR). The `GoRedirect` Preact island
(`client:only`) mints a `ref_code` (e.g. `BW26-7Q3K9F`, unambiguous base32), builds the
destination URL, best-effort inserts a `booking_intent` row, shows staged progress, then
redirects via `window.location.replace`. **Fail-open is absolute**: a hard `REDIRECT_CAP_MS`
(6 s) cap and a `<noscript>` direct link guarantee hand-off regardless of insert latency or
error.
Code: [src/pages/go/[partner].astro](../src/pages/go/%5Bpartner%5D.astro),
[src/islands/GoRedirect.tsx](../src/islands/GoRedirect.tsx),
[src/lib/referrals.ts](../src/lib/referrals.ts),
[src/data/partners.ts](../src/data/partners.ts),
[006_booking_intent.sql](../database/migrations/006_booking_intent.sql).

### 2.2 Referral Attribution

**Business:** We cannot see the conversion, so we make the click **matchable**. The load-bearing
signal is the **promo code** (`ADVENTURE`): the guest says it at the desk, it lands on the
folio, and it appears on the partner's report. Weaker fallbacks (arrival date, member last
name, the raw ref code) back it up.

**Technical:** Attribution keys in priority order
([PARTNER_REFERRAL_ARCHITECTURE.md §4](PARTNER_REFERRAL_ARCHITECTURE.md)): (1) promo code,
(2) promo + arrival ±1 day, (3) member last name + arrival, (4) `ref_code`. Each outbound
click is one immutable `booking_intent` row (clients hold `SELECT`/`INSERT` only). The
guest-facing offer is **gated** behind `partners.ts › offerConfirmed`: while `false`, clicks
are still recorded but the promo param is withheld from the outbound URL. The lifecycle
(`clicked → confirmed → stayed | no_match | cancelled`) is resolved later by reconciliation.

### 2.3 Analytics

**Business:** Prove that the funnel is working — how many people call, click Book Now, submit
a lead, and pass through the referral interstitial — without any personally identifiable
tracking of individuals.

**Technical:** A `track(event, params)` helper ([src/lib/analytics.ts](../src/lib/analytics.ts))
that is a **no-op until GA4 is provisioned** (nothing fires early). GA4 + CallRail are wired in
[src/components/Analytics.astro](../src/components/Analytics.astro), dormant unless
`PUBLIC_GA4_MEASUREMENT_ID` / `PUBLIC_CALLRAIL_ID` are set. Events: `call_click`, `book_click`
(conversion surface); `corporate_lead_submit` / `corporate_lead_success` / `corporate_lead_error`
(lead form); and the four referral events fired **exactly once each**, in funnel order —
`partner_interstitial_view`, `partner_referral`, `booking_intent_created` (only on a
**successful** insert), `partner_redirect`
([M7_PARTNER_REFERRAL_VERIFICATION.md §5](M7_PARTNER_REFERRAL_VERIFICATION.md)).

### 2.4 Corporate Leads

**Business:** A business that wants a corporate rate or a room block fills out a form and the
front desk gets an email immediately. This is the **inbound** funnel — a person asking us to
follow up — kept deliberately separate from the outbound booking-intent funnel.

**Technical:** [src/pages/corporate-rates.astro](../src/pages/corporate-rates.astro) hosts the
[CorporateRateForm](../src/islands/CorporateRateForm.tsx) island, which validates and calls
`submitLead()` ([src/lib/leads.ts](../src/lib/leads.ts)) to insert a `lead` row (anonymous
INSERT permitted by RLS `lead_insert`; nobody can read leads without the service role). If
Supabase is unconfigured it **degrades to a pre-filled `mailto`** so no lead is lost. A
Supabase Insert webhook fires the [lead-notify Worker](../workers/lead-notify.ts), which
verifies a shared secret and emails the front desk via Resend.

### 2.5 Partner Importer

**Business:** Once a month the partner sends a reservation CSV. We ingest it into a staff-only
store so it can be reconciled, and we keep the file verbatim so a future, smarter matcher can
be re-run against it. The importer is **generic**: onboarding a new partner is writing a
configuration object, never changing importer code.

**Technical:** An off-browser Node CLI (Node ≥ 22.12, ESM, **zero runtime dependencies**) run
with the **service-role key**; unlike the browser gateway it is **atomic and aborts on error**,
not fail-open. The pipeline is `parse → transform → validate → dedup → persist`, each a pure,
unit-tested module. A **partner profile** ([scripts/report-import/profiles.mjs](../scripts/report-import/profiles.mjs))
declares — as data — the header mappings, date / currency / room-night parsers, constants,
reservation-status and cancellation/refund mappings, and encoding; the partner-agnostic
transform normalizes the CSV into the canonical line shape. Every line lands as
`status='unmatched'`; the importer does **not** match, reconcile, or compute commission.
Entry point: [scripts/import-report.mjs](../scripts/import-report.mjs)
(`npm run report:import`); reference: [M6_CSV_IMPORTER.md](M6_CSV_IMPORTER.md).

### 2.6 Reconciliation Engine

**Business:** This is the step that turns "we recorded the click and imported the report" into
"we know which clicks became **paid stays**, and what they're worth." It produces the monthly
reconciliation the business runs on.

**Technical:** A second off-browser, service-role, abort-on-error CLI
([scripts/reconcile.mjs](../scripts/reconcile.mjs), `npm run reconcile:run`). It links
`partner_report_line` rows (importer) to `booking_intent` rows (gateway) using the four
confidence tiers, then advances each matched intent to its observed outcome, fills attributed
revenue and room-nights, and computes commission. It **never guesses** (a line matching more
than one available intent is flagged `ambiguous` for a human), **never double-matches** (one
line ↔ one intent, backed by a unique index in migration `010`), and is **idempotent** (writes
are guarded by source status, so re-running changes nothing). Commission is
`round(revenue_cents × commission_percent ÷ 100)` on **stayed** rows only; if the partner has
no `commission_percent` on record it is left **NULL**, never invented.
Reference: [M8_RECONCILIATION_VERIFICATION.md](M8_RECONCILIATION_VERIFICATION.md).

### 2.7 Reporting

**Business:** Staff need to see the funnel — total clicks, members vs. anonymous, clicks by
partner, intent status, top landing pages, and recent referral history — without exposing any
of that data publicly.

**Technical:** `booking_intent` is service-role-only, so the report is generated **off the
browser**: [scripts/booking-report.mjs](../scripts/booking-report.mjs) reads via the
service-role key and writes a self-contained, theme-aware static `reports/booking-report.html`
(gitignored — rows carry member UUIDs). No endpoint, no SSR, no service-role key in the site
build. It is **operational only** — no financial reconciliation; that is the reconciliation
engine's job ([M7_PARTNER_REFERRAL_VERIFICATION.md §6](M7_PARTNER_REFERRAL_VERIFICATION.md)).

---

## 3. Repository Architecture

The repository is a single Astro 6 project with three cooperating layers: a **static
marketing/gateway site** (browser), a **Postgres backend** (Supabase), and **off-browser staff
tooling** (Node CLIs). The service-role key never enters the site build or a browser.

```
bestwesternastro/
├── src/                        The Astro application (browser layer)
│   ├── pages/                  File-routed pages → /page.html (build.format:'file')
│   │   └── go/[partner].astro  Booking Gateway interstitial (one prerendered page per partner)
│   ├── islands/                Interactive Preact islands (.tsx)
│   │                           – GoRedirect (gateway), CorporateRateForm (leads),
│   │                             Pass* (member suite — EXCLUDED scope, §1.4)
│   ├── components/             Static .astro partials: Header, Footer, CTA, FAQ,
│   │                           StickyBookingBar, Analytics, Breadcrumbs, RelatedLinks…
│   ├── layouts/BaseLayout.astro  Shared page shell (head, OG/schema, nav/footer, Analytics)
│   ├── lib/                    Client/service logic
│   │                           – supabase.ts (anon client), referrals.ts, leads.ts,
│   │                             analytics.ts, database.types.ts
│   │                           – auth/profile/trip/favorites… (EXCLUDED scope, §1.4)
│   ├── data/                   Typed static data (offline-first, ADR-007)
│   │                           – partners.ts (public partner config), business.ts (NAP)
│   └── styles/                 tailwind.css, global.css, conversion.css
│
├── database/
│   ├── migrations/             Ordered SQL: 001 schema · 002 RLS · 003 functions ·
│   │                           004 grants · 005 favorite · 006 booking_intent ·
│   │                           007 location fields · 008 booking journey ·
│   │                           009 partner_report · 010 reconciliation
│   ├── seed/                   Destination + location seed data
│   └── tests/                  schema_checks.sql, rls_checks.sql (the verify:db gate)
│
├── scripts/                    Off-browser staff tooling (Node ≥22.12, ESM, service-role)
│   ├── import-report.mjs       Partner Importer entry point (npm run report:import)
│   ├── report-import/          Importer modules — parser, canonical, profiles, validate,
│   │                           dedup, persist (+ co-located *.test.mjs)
│   ├── reconcile.mjs           Reconciliation entry point (npm run reconcile:run)
│   ├── reconcile/              Matcher modules — rules, match, commission, persist, cli
│   │                           (+ co-located *.test.mjs)
│   ├── booking-report.mjs      Reporting: booking_intent → static HTML dashboard
│   ├── generate-catalogue.mjs  Knowledge-graph catalogue generator (EXCLUDED scope, §1.4)
│   └── verify-db.mjs           Live schema + RLS verification (npm run verify:db)
│
├── workers/                    Cloudflare Worker — lead-notify.ts + wrangler.toml
│                               (Supabase lead-INSERT webhook → Resend email to front desk)
├── tests/visual/               Playwright visual-regression suite + committed snapshots
├── reports/                    Generated reports + inbox/ CSV drop folder (gitignored)
├── public/                     Static assets, robots.txt, sitemap.xml, _redirects
└── docs/                       Architecture, milestone verification, runbooks, ADRs
```

**Where each subsystem lives:**

| Subsystem | Primary code |
|---|---|
| Booking Gateway | `src/pages/go/[partner].astro`, `src/islands/GoRedirect.tsx`, `src/lib/referrals.ts`, `src/data/partners.ts` |
| Referral Attribution | `src/lib/referrals.ts`, `src/data/partners.ts`, `database/migrations/006_booking_intent.sql`, `008_booking_journey.sql` |
| Analytics | `src/lib/analytics.ts`, `src/components/Analytics.astro` |
| Corporate Leads | `src/pages/corporate-rates.astro`, `src/islands/CorporateRateForm.tsx`, `src/lib/leads.ts`, `workers/lead-notify.ts` |
| Partner Importer | `scripts/import-report.mjs`, `scripts/report-import/**` |
| Reconciliation Engine | `scripts/reconcile.mjs`, `scripts/reconcile/**`, `database/migrations/010_reconciliation.sql` |
| Reporting | `scripts/booking-report.mjs`, `reports/` |

---

## 4. Data Flow — the complete booking journey

A single arrow from an anonymous visitor to an attributed, commissionable line of revenue.
The dashed boundary marks the point where the visitor leaves our infrastructure and the
conversion becomes invisible to us — the whole platform exists to bridge that gap after the
fact.

```
 ┌────────────┐
 │  Visitor   │  arrives on an SEO / marketing page (index, hotel-near-*, extended-stay…)
 └─────┬──────┘
       │  browses; sees the sticky "Book Now" / call CTA
       ▼
 ┌──────────────────────┐
 │  Adventure Tours /    │  Marketing site (static Astro, StickyBookingBar)
 │  Vernal landing pages │  GA4: call_click · book_click
 └─────┬────────────────┘
       │  clicks "Book Now"
       ▼
 ┌──────────────────────────────────────────────┐
 │  Booking Gateway   /go/[partner]              │  GoRedirect island (fail-open ≤ 6 s)
 │  • mint ref_code (BW26-7Q3K9F)                │  GA4: partner_interstitial_view,
 │  • INSERT booking_intent (best-effort)        │       partner_referral,
 │  • show code + staged progress                │       booking_intent_created (on insert),
 └─────┬────────────────────────────────────────┘       partner_redirect
       │  window.location.replace(destinationUrl)   [ref + utm always; promo iff offerConfirmed]
 - - - │ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
       ▼                                             ⟵ conversion is INVISIBLE to us past here
 ┌──────────────────────┐
 │  Partner Booking      │  theworld24.com (not ours) — guest completes (or abandons) the stay
 │  Engine               │
 └─────┬────────────────┘
       │  once a month, partner exports its reservations
       ▼
 ┌──────────────────────┐
 │  Monthly CSV          │  dropped into reports/inbox/  (gitignored; verbatim)
 └─────┬────────────────┘
       ▼
 ┌──────────────────────────────────────────────┐
 │  Importer   npm run report:import             │  profiles.mjs selects the partner profile;
 │  parse → transform → validate → dedup →        │  normalizes to canonical lines;
 │  persist                                       │  → partner_report / partner_report_line
 └─────┬────────────────────────────────────────┘     (every line status = 'unmatched')
       ▼
 ┌──────────────────────────────────────────────┐
 │  Reconciliation   npm run reconcile:run        │  match report lines ↔ booking_intent
 │  ref_code → promo+arrival+name → promo+arrival │  clicks by confidence tier;
 │  → promo-only ; ambiguous → flagged            │  derive stayed/cancelled; fill revenue,
 │                                                │  room-nights; compute commission
 └─────┬────────────────────────────────────────┘
       ▼
 ┌──────────────────────┐
 │  Reporting            │  booking-report.mjs → reports/booking-report.html
 │                       │  (clicks, status, partners, attributed revenue & commission)
 └──────────────────────┘
```

**Fail-open vs. abort-on-error, by design:** everything on the browser side of the dashed line
(gateway, lead form) **fails open** — a backend problem never blocks a booking or a lead.
Everything off-browser (importer, reconciliation, reporting) runs with the service-role key and
**aborts on error** — staff tooling must never write a partial or wrong financial record.

---

## 5. Completed Milestones

Milestones are recorded as **built + verified** in their own reports under `docs/`. The
platform was built as two parallel workstreams whose numbering overlaps in the source docs;
this is a known documentation artifact, not a defect
([M6_PRODUCTION_VALIDATION.md, Finding A](M6_PRODUCTION_VALIDATION.md)). The table below groups
them by which V1.0 mission they serve and points to the authoritative report for each.

### 5.1 Milestones that constitute the V1.0 booking platform

| Milestone | Delivered | Report |
|---|---|---|
| **M1 — Infrastructure** | Versioned Postgres schema, default-deny RLS, RPC functions, table grants; the corporate-lead pipeline (form → `lead` → Worker → email) and the analytics event baseline. DB layer verified live; application layer verified offline. | [M1_VERIFICATION_REPORT.md](M1_VERIFICATION_REPORT.md), [M1_LEAD_PIPELINE_VERIFICATION.md](M1_LEAD_PIPELINE_VERIFICATION.md) |
| **M7 — Partner Referral & Attribution Engine** | The `/go` gateway completed: immutable booking-intent records, the four named GA4 referral events (deduped, success-gated), the journey snapshot (migration `008`), partner-type-agnostic config, and the off-browser operational dashboard. | [M7_PARTNER_REFERRAL_VERIFICATION.md](M7_PARTNER_REFERRAL_VERIFICATION.md), [PARTNER_REFERRAL_ARCHITECTURE.md](PARTNER_REFERRAL_ARCHITECTURE.md) |
| **M6 — Partner CSV Importer** | The generic importer (migration `009`): RFC-4180 reader, canonical line contract, profile-driven transform, validation manifest, file-hash dedup with `--replace`, atomic service-role persistence, and the slug-keyed partner-profile registry. | [M6_CSV_IMPORTER.md](M6_CSV_IMPORTER.md), [M6_CSV_IMPORTER_CHECKLIST.md](M6_CSV_IMPORTER_CHECKLIST.md) |
| **M8 — Matching & Reconciliation Engine** | The deterministic matcher (migration `010`): four-tier confidence classification, one-line-one-intent resolution with an ambiguous-flag safety valve, conservative stay-outcome derivation, commission computation (NULL when the rate is unknown), idempotent guarded writes, and `--dry-run`. | [M8_RECONCILIATION_VERIFICATION.md](M8_RECONCILIATION_VERIFICATION.md) |

### 5.2 Milestones built but outside the V1.0 mission scope

Present in the repository from an earlier product direction; **excluded** from the booking
platform per [DESCOPE_PLAN.md](DESCOPE_PLAN.md) and a candidate for relocation to
`adventureastro`. Recorded here for completeness only:

| Milestone | Delivered | Report |
|---|---|---|
| **M2 — Identity (Adventure Pass)** | Passwordless magic-link sign-in, `/pass` dashboard, client-side guard, optional member profile. Built + offline-verified. | [M2_IDENTITY_VERIFICATION.md](M2_IDENTITY_VERIFICATION.md) |
| **M4 — Adventure Pass Itinerary** | Saved adventures (favorites), My Adventures dashboard, deterministic (non-AI) trip planner, trip status. Built + offline-verified. | [M4_ITINERARY_VERIFICATION.md](M4_ITINERARY_VERIFICATION.md) |
| **Knowledge Base** | Location catalogue (migration `007`) compiled into static pages; catalogue generator. | [M6_KNOWLEDGE_BASE_VERIFICATION.md](M6_KNOWLEDGE_BASE_VERIFICATION.md), [M6_PRODUCTION_VALIDATION.md](M6_PRODUCTION_VALIDATION.md) |

---

## 6. Testing Summary

The platform is guarded at four levels; all offline gates are green at V1.0.

### 6.1 Unit tests (`node --test`)

Pure, dependency-free modules with co-located tests. **209 tests, all passing:**

- **Importer** — `node --test scripts/report-import/*.test.mjs` → **151 passing** (canonical
  shape, CSV reader, profile-driven transform, validation manifest, dedup, persistence, CLI
  read + write paths, and the partner-profile registry).
- **Reconciliation** — `node --test scripts/reconcile/*.test.mjs` → **58 passing** (tier
  classification, deterministic matching, commission/outcome derivation, persistence, CLI
  orchestration).

### 6.2 Validation gate — `npm run verify` (offline)

Runs **build → typecheck → lint → format:check** in one command:

- `astro build` — full static build (~26 pages).
- `astro check` — TypeScript typecheck (last recorded: 0 errors / 0 warnings / 0 hints).
- `eslint .` — clean.
- `prettier --check .` — clean.

### 6.3 Database verification — `npm run verify:db` (live)

`scripts/verify-db.mjs` runs `database/tests/schema_checks.sql` and `rls_checks.sql` against
the live project to confirm the right objects/extensions/policies exist and that RLS is
correctly scoped — anon cannot read `lead` or any member data, and the staff-only tables
(`booking_intent`, `partner_report`, `partner_report_line`) are **service-role-only**. Requires
a live DB connection and the service-role credential; it cannot run purely offline.

### 6.4 Build validation

The production build emits static `/page.html` files (`build.format:'file'`,
[ADR-002](adr/ADR-002-preserve-flat-html-urls.md)) so legacy URLs are preserved. The importer
and reconciliation engines add **zero** client-side JavaScript — they are off-browser tooling —
so they cannot regress the public bundle.

### 6.5 Visual validation

Playwright visual regression, **12/12 passing**: `tests/visual/existing-pages.spec.ts`
parametrized over 6 representative pages (home, things-to-do, extended-stay, workforce-housing,
corporate-rates, 404) × desktop + mobile. It serves the built `dist/` via `astro preview`,
stabilizes timers/fonts/animations, and compares against committed baselines
(`maxDiffPixelRatio: 0.01`). The gateway and reports are `noindex`/non-snapshotted; public
pages are asserted unchanged.

---

## 7. Production Deployment

The repository is deployment-ready but **dormant until the backend is provisioned**. Do **not**
duplicate the runbooks below — this section states only the **order**; each step's detail lives
in an existing document.

1. **Provision Supabase** (Pro tier, no pausing) and capture the project URL + anon +
   service-role keys — [PROVISIONING.md §1](PROVISIONING.md).
2. **Apply migrations in order** `001 → 010` and seed, via the Supabase **SQL Editor** (this
   repo does **not** use the Supabase CLI migration layout — `supabase db push` will not pick up
   `database/migrations/`) — [LOCAL_SUPABASE_SETUP.md §4](LOCAL_SUPABASE_SETUP.md),
   [PROVISIONING.md §2](PROVISIONING.md). Migration `001` enables `postgis` / `vector` /
   `uuid-ossp`.
3. **Wire site env** in Cloudflare Pages and `.env` — `PUBLIC_SUPABASE_URL`,
   `PUBLIC_SUPABASE_ANON_KEY` (this alone activates lead capture); optionally
   `PUBLIC_GA4_MEASUREMENT_ID` / `PUBLIC_CALLRAIL_ID` to light up analytics —
   [PROVISIONING.md §3](PROVISIONING.md).
4. **Deploy the lead-notify Worker** and set its secrets (`RESEND_API_KEY`,
   `LEAD_WEBHOOK_SECRET`), then verify the Resend sending domain —
   [PROVISIONING.md §4](PROVISIONING.md).
5. **Connect the Supabase → Worker webhook** on `lead` INSERT —
   [PROVISIONING.md §5](PROVISIONING.md).
6. **Deploy the site** to Cloudflare Pages (build `astro build`, output `dist`) —
   [README.md](../README.md).
7. **Verify live** — `npm run verify:db` green; submit a lead end-to-end; confirm GA4 events in
   DebugView — [STAGING_CHECKLIST.md §A–C](STAGING_CHECKLIST.md).
8. **Close the business gate** — once the partner confirms the promo code and monthly report and
   populates the commission rate, flip `partners.ts › offerConfirmed` to `true` and set
   `partner.commission_percent` — [PARTNER_REFERRAL_ARCHITECTURE.md §7](PARTNER_REFERRAL_ARCHITECTURE.md).

Day-to-day operation and incident response after deployment:
[RUNBOOK.md](RUNBOOK.md). Rollback of last resort is documented in
[STAGING_CHECKLIST.md §E](STAGING_CHECKLIST.md).

---

## 8. Operational Workflow — the monthly business process

Once live, the revenue chain is a repeatable monthly routine. Always run each engine with
`--dry-run` first to review the plan before any write.

```
   CSV arrives
   partner emails the monthly reservation report; drop it in reports/inbox/
        │
        ▼
   Import                npm run report:import -- --partner best-western-vernal \
                             --period YYYY-MM --file reports/inbox/<file>.csv [--dry-run]
   • dry-run: parse + validate, review the summary (rows, errors, warnings)
   • write: dedup (blocks a re-import of identical bytes; --replace supersedes a prior report),
     then persist every line as status='unmatched' with the raw row retained
        │
        ▼
   Reconcile             npm run reconcile:run -- --partner best-western-vernal \
                             --period YYYY-MM [--dry-run]
   • dry-run: compute + print the plan and totals, zero writes
   • write: match lines ↔ clicks by tier; advance intents to stayed/cancelled;
     fill revenue + room-nights; flag ambiguous lines for a human
        │
        ▼
   Review                open reports/booking-report.html
                         (regenerate first: node scripts/booking-report.mjs)
   • sanity-check totals, ambiguous lines, and any commission left NULL (unknown rate)
        │
        ▼
   Commission            computed automatically on stayed rows:
   • round(revenue_cents × commission_percent ÷ 100); NULL if no rate on record
   • cancelled/refunded rows earn 0 and are excluded from attributed revenue
        │
        ▼
   Archive               the source CSV is stored verbatim (partner_report.raw_csv);
   • re-runnable: an improved matcher can be re-applied later; re-running is idempotent
```

Because every write is status-guarded, a partial or interrupted run is simply **resumed by
running again**, and reconciliation can be re-run after a matcher improvement without
double-counting.

---

## 9. Known Limitations

These are **intentionally deferred** decisions at V1.0 — each is a conscious trade-off with a
documented reason, not an unresolved bug.

1. **Attribution offer is gated off.** `partners.ts › offerConfirmed` is `false`, so the promo
   param is withheld from outbound URLs until the partner agrees to honor the offer. Clicks are
   still recorded ([PARTNER_REFERRAL_ARCHITECTURE.md §4](PARTNER_REFERRAL_ARCHITECTURE.md)).
2. **The Best Western CSV contract is provisional.** The header/date/currency/encoding mapping in
   [M6_CSV_IMPORTER.md §2](M6_CSV_IMPORTER.md) is a scaffold; the BW import profile is written
   against it and must be re-checked and locked once the partner confirms the real export format.
3. **Commission rate may be unknown.** With no `commission_percent` on record, commission is left
   **NULL** by design (never `0`, never guessed); the reconciliation run reports how many stays
   were affected ([M8_RECONCILIATION_VERIFICATION.md §4](M8_RECONCILIATION_VERIFICATION.md)).
4. **Stay outcome is inferred.** The canonical import line has no explicit reservation-status
   column, so a cancellation/refund is inferred from non-positive revenue or nights. Faithful to
   the provisional contract; revisit `deriveOutcome` when the real format is known.
5. **Member-name matching (tier 2) is not wired by default.** It is supported but only fires when
   the caller supplies member names; the default wiring does not join `member_profile`, to avoid
   extra PII coupling. Tiers 1/3/4 cover the anonymous case.
6. **Reconciliation writes per row, not in one transaction.** Updates apply individually and abort
   on error; recovery is a re-run (safe because writes are status-guarded).
7. **The dashboard is pull, not live.** Staff run `booking-report.mjs` on demand; there is no
   hosted live page (that would require a Worker + auth). Chosen for zero new runtime surface.
8. **No rate-limiting / captcha on lead insert.** RLS allows anonymous INSERT; a honeypot or
   Turnstile check is tracked but not built ([STAGING_CHECKLIST.md §B](STAGING_CHECKLIST.md)).
9. **No internal health/status page.** Until one exists, the Daily checks in
   [RUNBOOK.md](RUNBOOK.md) are the health check.
10. **`database.types.ts` is hand-authored.** It should be regenerated (including the widened
    `partner_report_line.status` union) when types are next generated — cosmetic; no engine
    depends on it.

---

## 10. Future Enhancements (Version 1.1+)

Everything below is **out of Version 1.0** and deferred to a later release. They are separated
here deliberately: none is required for the V1.0 engine to be complete, and several are gated on
real data or a business decision rather than engineering.

**Attribution & reconciliation**
- Lock the Best Western CSV profile against the confirmed export; add an explicit
  reservation-status column and replace inferred outcomes with reported ones.
- Wire the tier-2 member-name join once the PII trade-off is accepted.
- Commission automation, billing, and referral scoring.

**Operations & surfaces**
- A hosted internal dashboard (Worker + auth) that folds the reconciliation totals — attributed
  revenue, commission, conversion % — into a live view rather than a pulled HTML file.
- An internal health/status page (Database / Workers / Email / AI / Maps / Analytics / backups).
- Lead spam controls (honeypot or Turnstile).

**Multi-tenant / partner growth**
- A `partner_public` DB **view** as the multi-tenant seam: `/go` config would move from
  `partners.ts` to a non-PII DB view feeding the build, **without changing the route contract**
  ([PARTNER_REFERRAL_ARCHITECTURE.md §6](PARTNER_REFERRAL_ARCHITECTURE.md)). Until then, TS config
  is the offline-first source ([ADR-007](adr/ADR-007-attraction-catalogue-in-typescript.md)).
- A partner-admin UI on top of that view.
- Trip-upsell on the interstitial (add tickets/coupons before hand-off) — the flow already pauses
  on our infrastructure, so the seam exists.

**Housekeeping**
- Reconcile the analytics event name `partner_referral` ↔ the mission's `booking_referral`
  (rename or document) ([DESCOPE_PLAN.md §5](DESCOPE_PLAN.md)).
- Resolve the excluded Adventure Pass / knowledge-graph code: relocate it to `adventureastro`
  per [DESCOPE_PLAN.md](DESCOPE_PLAN.md), or formally re-include it as a separate product.
- Regenerate `database.types.ts` from the live schema.

---

## 11. Definition of Done

**Version 1.0 is considered complete because the referral-attribution engine is code-complete
and verified end to end in the repository.** Every subsystem the product is defined by (§1.3)
exists, is wired together, and is proven by an automated or reproducible check. "Done" here means
the **engine and repository** are complete; live production certification and revenue activation
depend on deployment (§7) and a partner business agreement (§9), which are — by the mission's own
definition — outside the repository's scope.

Measurable completion criteria (all currently green):

- [x] **All unit tests pass** — `209/209` (`151` importer + `58` reconciliation), `node --test`.
- [x] **`npm run verify` is green** — build (~26 pages), `astro check` 0/0/0, ESLint clean,
      Prettier clean.
- [x] **Visual regression 12/12** — public pages unchanged; gateway/reports are non-snapshotted.
- [x] **The full pipeline runs offline** — a partner CSV imports cleanly (`--dry-run` summary
      OK) and reconciliation produces correct stays/revenue/commission on an in-memory dataset
      ([M8 §6](M8_RECONCILIATION_VERIFICATION.md)).
- [x] **Schema is complete and idempotent** — migrations `001`–`010` present; staff tables are
      service-role-only; the double-match backstop (unique index) is in place.
- [x] **The importer is generic** — adding a partner is a configuration object, proven by a
      second dummy profile registering with no core change ([§12](#12-repository-maintenance-notes)).
- [x] **Architecture is frozen and additive** — the public marketing site is untouched (no
      layout / route / CSS / component / SEO-page regression); all revenue work is off-browser.
- [x] **The system is partner-type agnostic** — nothing in the data model or engines branches on
      partner type.

Explicitly **not** part of this Definition of Done (tracked separately): live deployment,
production data certification, and the Best Western business agreement (promo registration +
commission rate). These are documented as gates in §7 and §9.

---

## 12. Repository Maintenance Notes

The single most important property to preserve: **onboarding a new partner is configuration, not
architecture.** The data model uses a partner **slug** everywhere (`booking_intent.partner_slug`,
`partner_report.partner_slug`) and **no engine branches on partner type**. Adding a partner should
never require touching the gateway, the importer core, or the reconciliation engine.

### 12.1 How to add a new partner

Three configuration edits, no engine changes:

1. **Public gateway config** — add one entry to
   [src/data/partners.ts](../src/data/partners.ts) keyed by slug (name, `bookingUrl`,
   `promoCode`, `refPrefix`, `offer`, `offerConfirmed`). `getStaticPaths` emits the
   `/go/<slug>` route automatically — **no routing change**. `type` is descriptive only (it
   groups the dashboard and labels the interstitial); nothing branches on it.
2. **Server-side partner row** — insert the partner into the `partner` table with its
   **secret** fields (`commission_percent`, report email). These stay server-side and are never
   anon-readable.
3. **Import profile** — add one `defineProfile({...})` entry to
   [scripts/report-import/profiles.mjs](../scripts/report-import/profiles.mjs), keyed by the same
   slug, describing that partner's CSV. That is the only change needed for the importer to accept
   the new partner's report.

### 12.2 How importer profiles work

A **profile** is pure declarative data compiled by `defineProfile(config)` into the exact shape
the partner-agnostic transform consumes. A config object defines:

- `slug` — the registry key (`--partner <slug>`).
- `acceptedHeaders` — the CSV header set the export is expected to carry.
- `map` — canonical field → source header name (field mappings).
- `parsers` — `date`, `currency`, and `roomNights` coercers, built from the reusable factories
  `makeDateParser`, `makeCurrencyParser`, `makeIntegerParser` (and `makeStatusMapper`). These
  normalize a partner's formats (e.g. `MM/DD/YYYY`, `"$1,299.50"`) into canonical values (ISO
  dates, integer cents, positive integers).
- `constants` — canonical fields set to a fixed value (e.g. `currency: 'USD'`), not a column.
- `unitLabel` — the constant `unit_label` (what `quantity` counts, e.g. `room_nights`).
- `reservationStatus` / `cancellation` — raw status → normalized status, and which statuses are
  refunds/cancellations.
- `encoding` — charset / BOM / delimiter expectations.

`getProfile(slug)` resolves a profile from the registry (unknown slug → `null`, which the CLI
reports cleanly). `defineProfile` **validates at registration**: it throws if a required canonical
field is uncovered or a mapping targets a field that is not part of the canonical contract, so a
misconfigured partner fails loudly at load time rather than mid-import. This design is proven
generic by the test suite, where a second, entirely different dummy partner registers and imports
with **zero** changes to any core module.

### 12.3 Where future configuration belongs

| Configuration | Home | Why |
|---|---|---|
| Public partner fields (`bookingUrl`, `promoCode`, `refPrefix`, `offer`, `offerConfirmed`) | `src/data/partners.ts` | Offline-first, build-time, safe to expose ([ADR-007](adr/ADR-007-attraction-catalogue-in-typescript.md)) |
| Secret partner fields (`commission_percent`, report email) | `partner` table (DB) | Server-side only; never anon-readable |
| CSV import mapping (headers, parsers, status/refund, encoding) | `scripts/report-import/profiles.mjs` | Declarative, per-partner; the generic-importer seam |
| Business identity (NAP, phone, hours, geo) | `src/data/business.ts` | Single source of truth for the marketing site |
| Reconciliation behavior (window days, aging) | CLI flags (`--window-days`, `--age-days`) | Per-run knobs, not hardcoded |

When a partner-admin UI eventually arrives, the public gateway config migrates from
`partners.ts` to a `partner_public` DB view **without changing the `/go` route contract** — only
the _source_ of `bookingUrl`/`promoCode`/`refPrefix` changes (§10). That is the intended
multi-tenant seam; keep it in mind before hardcoding anything partner-specific into an engine.

**In one sentence:** if onboarding a partner ever seems to require an engine change, that is a
signal the change belongs in configuration instead — the architecture is built so it can.
