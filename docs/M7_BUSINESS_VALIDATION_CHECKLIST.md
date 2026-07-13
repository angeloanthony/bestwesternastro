# M7 — Business Validation Readiness Checklist

**Status:** execution-ready. No new features. This is the operational checklist that turns
the GM meeting into the first production import.

**Purpose.** The software is feature-complete *pending one input*: Best Western's confirmed
CSV export format. This document (a) records what the repository is still waiting on, (b) is
filled in *during/after* the GM meeting, and (c) drives the exact sequence from "confirmed
contract" → "first monthly dashboard." It authors **no code and no migrations** — it is a
map of the work that becomes unblocked the moment the contract lands.

> **Scope guardrail (do not violate):** do not build features, redesign architecture, or
> modify the booking gateway, importer, reconciliation pipeline, schema, or public site
> while executing this checklist. The only code that changes after the meeting is the small,
> pre-scoped set in **Section D** — all of it already designed and stubbed.

---

## Executive summary

- **The single remaining blocker is a business input, not code.** The importer profile
  (`scripts/report-import/profiles.mjs`) is built and wired at
  [`scripts/import-report.mjs`](../scripts/import-report.mjs#L34) — `resolveProfile = getProfile`
  — and `best-western-vernal` resolves today against the **provisional** §2 contract. The
  remaining dependency is confirming and **locking** that contract (T17). An unknown slug still
  fails cleanly via the `no profile registered` path in
  [`cli.mjs`](../scripts/report-import/cli.mjs#L181) — by design, the importer refuses to guess a mapping.
- **The pipeline is built and offline-verified:** parse → validate → dedup →
  persist (importer, **151 tests**) and match → commission → apply (reconciliation, **58
  tests**, per [M8_RECONCILIATION_VERIFICATION.md §9](M8_RECONCILIATION_VERIFICATION.md)).
- **Nothing is verified *live in production* yet.** Per [ROADMAP.md](ROADMAP.md), a milestone
  is "verified" only against a live environment; migrations `009`/`010` are in the repo but
  the live apply + `npm run verify:db` + first real run are pending.
- **Three business decisions gate go-live**, none of them engineering: (1) the CSV contract,
  (2) registering + honoring the `ADVENTURE` promo code, (3) a commission percentage in the
  signed agreement.
- **Recommendation:** the project *is* ready to go to production **after** the GM meeting
  confirms the CSV contract and the promo-code cooperation — the remaining code is a few
  hours (Section D). See the final **Go / No-Go** call.

---

## A. Meeting outcomes  *(fill in during/after the GM meeting)*

The two source lists of questions already live in the repo — bring them verbatim:

- **Business cooperation** — [PARTNER_REFERRAL_ARCHITECTURE.md §7](PARTNER_REFERRAL_ARCHITECTURE.md)
- **CSV mechanics** — [M6_CSV_IMPORTER.md §2](M6_CSV_IMPORTER.md)

| # | Question (source) | Answer | Confidence |
|---|---|---|---|
| 1 | Can you provide a **monthly reservation report**? (§7) | | |
| 2 | Can it include the **promo code** used? (§7) | | |
| 3 | Can it include **arrival date, room nights, confirmation #**? (§7) | | |
| 4 | Cadence — how often / by what date each month? (§7) | | |
| 5 | Any **corporate restrictions** on sharing this data? (§7) | | |
| 6 | Will you **register `ADVENTURE`** and **honor** the check-in offer? (§7) | | |

**What remains unknown after the meeting:**

- …

**Decision log** (date · decision · who):

- …

---

## B. Reservation system  *(what the PMS/CRS can actually do)*

The whole attribution strategy rests on one thing surviving the booking engine's funnel and
appearing on the report. Per [PARTNER_REFERRAL_ARCHITECTURE.md §4](PARTNER_REFERRAL_ARCHITECTURE.md),
the **promo code (`ADVENTURE`) is the load-bearing signal** — `ref`/`utm` URL params are
assumed stripped by the engine and are *not* something the partner reports.

- [ ] Can referral / source / rate / market codes be **created** in the system?
- [ ] **Who controls** them — property staff, or corporate?
- [ ] Is **corporate approval** required, and does it exist?
- [ ] Can guests **enter the code online** (booking engine), or only say it at the desk?
- [ ] Does the code **appear in the exported report** (not just internally)?

**Decision:** which attribution key is confirmed reliable? _(promo / rate code / source code /
ref code / none)_ → this determines whether the current tier model
([M8 §3](M8_RECONCILIATION_VERIFICATION.md)) holds as-is or needs a business-workflow tweak.

---

## C. CSV contract  *(record the CONFIRMED values — supersedes the provisional table)*

Today's contract in [M6_CSV_IMPORTER.md §2](M6_CSV_IMPORTER.md) is **provisional — every field
is `⛔ TBD`**. Fill the confirmed column below; that becomes the spec for `profiles.mjs`
(Section D). **Do not invent column names** — leave blank until BW confirms.

| Canonical field | Confirmed BW header | Confirmed format |
|---|---|---|
| `external_ref` (confirmation #) | | unique per row? |
| `customer_name` | | e.g. `Last, First`? |
| `promo_code` | | |
| `service_start` (arrival) | | date format? |
| `service_end` (departure) | | date format? |
| `quantity` (nights) | | positive integer |
| `revenue_cents` (room revenue) | | currency/symbol/thousands/cents? |
| `currency` | | `USD` constant, or a column? |

**File-level facts to confirm:**

- [ ] **Filename** pattern (if any)
- [ ] **Encoding** — UTF-8 vs Windows-1252 (importer assumes UTF-8, strips BOM)
- [ ] **Delimiter** — comma vs tab/semicolon (importer assumes comma / RFC-4180)
- [ ] **Headers** present, and their exact order
- [ ] **Date format** + timezone assumption
- [ ] **Currency format** — symbol, thousands separator, cents included?
- [ ] **One row per stay** (with a nights count) **or** one row per night?
- [ ] **Confirmation number** uniqueness (one per stay?)
- [ ] **Refunds** — how represented? (negative revenue? a status column?)
- [ ] **Cancellations** — present in the export, or omitted?

> ⚠️ **Assumption flagged:** the reconciliation engine currently *infers* cancelled/refunded
> from non-positive revenue or nights ([M8 §4](M8_RECONCILIATION_VERIFICATION.md),
> `deriveOutcome`). If BW's real export carries an **explicit status column**, that inference
> must be revisited (Section D). This is the one place a real column could change downstream
> logic.

---

## D. Required repository changes after the meeting  *(the ONLY code that changes)*

Every item below is already designed and stubbed; none is a redesign. Ordered by dependency.

- [x] **`scripts/report-import/profiles.mjs`** *(M6 · T04 — the primary deliverable)* — **built.**
  Slug-keyed registry + the `best-western-vernal` profile: header→canonical map, date
  coercer, currency→cents coercer, `unit_label='room_nights'`, `getProfile(slug)`. Currently
  built against the **provisional** §2 contract; re-check against the **confirmed** Section C
  values when the contract is locked (T17).
- [x] **Wire the profile in** [`scripts/import-report.mjs`](../scripts/import-report.mjs#L34) —
  **done.** `const resolveProfile = getProfile;` (imported from `profiles.mjs`). With a profile
  registered, `best-western-vernal` imports; an unknown slug still returns `no profile registered`.
- [ ] **Synthetic fixtures** *(M6 · T05b)* — `scripts/report-import/fixtures/`: a synthetic
  BW sample matching the confirmed headers + edge cases (dup confirmation, bad date, negative
  revenue, nights/date mismatch, extra column). **No real guest PII.**
- [ ] **Lock the CSV contract doc** *(M6 · T17)* — replace the provisional
  [M6_CSV_IMPORTER.md §2](M6_CSV_IMPORTER.md) table with the confirmed one from Section C;
  drop the `⛔ provisional` banner.
- [ ] **Revisit `deriveOutcome`** *(only if §C reveals an explicit status/cancellation column)*
  in [`scripts/reconcile/commission.mjs`](../scripts/reconcile/commission.mjs) — otherwise
  leave the conservative inference as-is.
- [ ] **`partners.ts` gate flip** — set `offerConfirmed: true` at
  [`src/data/partners.ts:47`](../src/data/partners.ts#L47) **only after** the GM confirms
  question 6 (registers `ADVENTURE` + honors the offer). One flag, no other code change.
- [ ] **`partner.commission_percent`** — populate from the signed agreement (DB value, not
  code). Until then the reconciler runs and reports but leaves commission `NULL` by design
  ([M8 §4](M8_RECONCILIATION_VERIFICATION.md)).
- [ ] **`src/lib/database.types.ts`** — regenerate for the widened
  `partner_report_line.status` union (cosmetic; [M8 §8.4](M8_RECONCILIATION_VERIFICATION.md)).
- [ ] **Acceptance re-validation** — re-run the importer + reconciler suites against the new
  profile/fixtures (`node --test scripts/report-import/*.test.mjs` and `scripts/reconcile/*.test.mjs`).

> Assumption flagged: no *new* migration is expected. `009` (partner_report tables) and `010`
> (reconciliation) already exist in `database/migrations/`. If BW's format needs a column the
> canonical record lacks, that is a schema conversation — surface it, do not silently add one.

---

## E. Go / No-Go checklist  *(all must be green before the first production import)*

**Business gates**

- [ ] BW confirmed it **can** and **will** send a monthly report (A/§7 Q1, Q4).
- [ ] The **attribution key is confirmed reliable** and appears on the export (Section B).
- [ ] `ADVENTURE` **registered + honored** → `offerConfirmed` flipped (Section D). *(Attribution
  works even if this is still `false`; this gate governs showing the guest-facing offer.)*

**Contract gates**

- [ ] Section C fully filled from a **real sample CSV** (no `TBD` left).
- [x] `profiles.mjs` built + wired — `best-western-vernal` resolves (provisional); importer no
  longer returns `no profile registered`. **Re-validate against the confirmed profile + fixtures** before the first production import.
- [ ] Fixtures created; importer + reconciler suites green against the real profile.

**Live-environment gates** (per [ROADMAP.md](ROADMAP.md) — "verified" = proven live)

- [ ] Migrations `009` + `010` applied; `npm run verify:db` green (both tables still
  service_role-only, RLS default-deny).
- [ ] `partner_report` / `partner_report_line` `SELECT` returns **0 rows, not an error**
  ([M6 §1.1](M6_CSV_IMPORTER.md)).
- [ ] A **`--dry-run`** of the real sample passes with zero fatal errors and zero writes.

---

## F. Risks

**Business risks**

- **BW cannot/will not provide a reliable referral signal.** The single biggest risk. If no
  promo/rate/source/ref code survives to the report, attribution degrades to name+arrival-date
  matching (medium confidence, [§4 tier 2/3](PARTNER_REFERRAL_ARCHITECTURE.md)). Mitigation is
  a **business-workflow** decision, not a platform redesign.
- **Corporate data-sharing restrictions** block or delay the monthly export (A/§7 Q5).
- **No commission agreement** → the reconciler reports revenue and room nights but leaves
  commission `NULL` (by design). Revenue impact can still be demonstrated without it.

**Technical risks**

- **Real export diverges from the provisional contract** — extra columns, one-row-per-night
  instead of per-stay, an explicit cancellation status. All absorbable by `profiles.mjs` /
  `deriveOutcome`; only a genuinely new *field* is a schema conversation.
- **Encoding/delimiter surprise** (Windows-1252, tab-delimited). Absorbable in the profile.
- Nothing in the pipeline is **live-verified** yet — first live run may surface
  environment/RLS/grant issues the offline suite cannot.

**Operational risks**

- **Real guest PII** in the CSV. Source files belong in gitignored `reports/inbox/`; the
  staff-only tables are RLS default-deny / service_role-only ([M6 §4.5](M6_CSV_IMPORTER.md)).
  Never commit a real partner file.
- **Service-role key handling** — the write path runs with a server secret; it must never
  enter the site build or a browser.
- **Duplicate / re-import mistakes** — mitigated by sha256 dedup + `--replace`
  ([M6 §4.3](M6_CSV_IMPORTER.md)), but operator discipline still matters.

---

## G. First production import sequence  *(exact order, once Section E is green)*

1. **Receive** the first real monthly CSV from BW; drop it into `reports/inbox/` (gitignored).
   Do **not** commit it.
2. **Confirm schema is live** — run the [M6 §1.1](M6_CSV_IMPORTER.md) verification query with
   the service-role key: both tables return 0 rows, no error. If "relation does not exist,"
   apply `009`/`010` first.
3. **Dry-run** (no writes):
   ```
   npm run report:import -- --partner best-western-vernal --period <YYYY-MM> \
     --file reports/inbox/<file>.csv --dry-run
   ```
   Expect: parse + validation summary, exit 0. Fix any fatal manifest items (likely a
   `profiles.mjs` mapping mismatch) before proceeding.
4. **Real import**:
   ```
   PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
     npm run report:import -- --partner best-western-vernal --period <YYYY-MM> \
       --file reports/inbox/<file>.csv --operator <name>
   ```
   Expect: header + lines land as `status='unmatched'`; `booking_intent` untouched.
5. **Reconcile — dry-run first**:
   ```
   npm run reconcile:run -- --partner best-western-vernal --period <YYYY-MM> --dry-run
   ```
   Review the plan (matches / ambiguous / unmatched, revenue, room nights, commission).
6. **Reconcile — real run**: intents advance to `stayed`/`cancelled`; lines carry
   `booking_intent_id` + `status='matched'`; revenue/room-nights fill; commission fills iff
   `commission_percent` is set. **Re-run once → no changes** (idempotency, [M8 §5](M8_RECONCILIATION_VERIFICATION.md)).
7. **Produce the dashboard / report** — the measured-impact artifact for the GM
   (website referrals → confirmed bookings → room nights → revenue). *Assumption flagged:*
   the offline booking report exists (`scripts/booking-report.mjs` → `reports/booking-report.html`,
   reads `booking_intent`); presenting reconciled revenue/room-nights/commission to the GM may
   need a small reporting pass on the reconciled data. This is the Phase-2 "populate with real
   data" step, not new platform work.
8. **Hotel review** — walk the GM through the numbers; capture corrections into the decision
   log (Section A); repeat for 2–3 months to prove a repeatable process before onboarding
   additional partners.

---

## Files created / modified by this task

- **Created:** `docs/M7_BUSINESS_VALIDATION_CHECKLIST.md` (this file).
- **Modified:** none. No code, migrations, schema, gateway, importer, reconciler, or public
  page was touched.

## Remaining blockers (single source of truth)

1. **CSV contract unconfirmed** → `profiles.mjs` cannot be built, `resolveProfile` stays
   `null`, no import can run. *(Business input — the GM meeting.)*
2. **Promo-code cooperation unconfirmed** → `offerConfirmed` stays `false`. *(Business input.)*
3. **Commission percentage not agreed** → reconciler reports revenue but commission stays
   `NULL`. *(Business input — signed agreement.)*
4. **No live verification yet** → migrations applied + `verify:db` + first real run pending.
   *(Execution, unblocked by #1.)*

## Recommendation

**The software is ready for production the moment the GM meeting resolves blockers #1 and #2.**
The remaining engineering is small, pre-scoped, and low-risk (Section D — a profile object, a
one-line wiring change, fixtures, a doc lock). The heavy machinery — importer (138 tests) and
reconciler (58 tests) — is built and offline-verified. Do **not** write more features before
the meeting; the highest-value next action is to walk in with Sections A–C and come out with a
confirmed CSV sample.
