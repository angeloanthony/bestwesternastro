# M7 — Partner Referral & Attribution Engine — Verification Report

**Status (2026-07-11):** application + data layer **built + offline-verified**.
M7 **completes** the attribution spine scaffolded in migration 006: it adds the
immutable journey snapshot, the four named analytics events, an internal
operational dashboard, and verify:db coverage — turning "every outbound partner
click is recorded" into "every click is *measurable and reportable*." Additive
only; no redesign, no SSR, no AI. See [PARTNER_REFERRAL_ARCHITECTURE.md](PARTNER_REFERRAL_ARCHITECTURE.md)
for the underlying design (problem, attribution keys, reconciliation).

The objective is **business**: prove AdventureOS can generate *attributable*
partner revenue. The code makes the click measurable; the revenue gate is a
partner-cooperation dependency, tracked in §7.

---

## 1. What changed (every affected file)

**New**

| File | Purpose |
|---|---|
| `database/migrations/008_booking_journey.sql` | Additive `saved_slugs` / `interests` / `has_itinerary` on `booking_intent` (Phase 3) |
| `scripts/booking-report.mjs` | Offline operational dashboard: service_role → static `reports/booking-report.html` (Phase 6) |
| `docs/M7_PARTNER_REFERRAL_VERIFICATION.md` | This report (Phase 7) |

**Modified**

| File | Change |
|---|---|
| `src/islands/GoRedirect.tsx` | Capture member journey snapshot (time-boxed, fail-open); emit the 4 named GA4 events (deduped, success-gated) |
| `src/lib/referrals.ts` | `RecordInput` + row mapping carry the snapshot fields |
| `src/lib/database.types.ts` | `BookingIntentRow`/`Insert` gain the 3 snapshot columns |
| `src/data/partners.ts` | First-class `type: PartnerType` (hotel is only the first type) |
| `database/tests/schema_checks.sql` · `rls_checks.sql` | verify:db coverage for `booking_intent` / `hotel_report` / `bi_insert` |
| `docs/PARTNER_REFERRAL_ARCHITECTURE.md` | Flow diagram → 4 events; dashboard marked built |
| `.gitignore` | `reports/` (report carries member UUIDs — never commit) |

**Not touched:** BaseLayout, URLs, global.css, SEO pages, Knowledge Base, auth,
`/pass` dashboard, Trip Planner, and the `booking_intent`/`partner` **core shape**
(008 is additive; the 006 grant model — INSERT-only for clients — is unchanged).

---

## 2. Architecture (Phase 1 — no redesign)

The booking-intent model from 006 was reviewed and kept as-is:

- **`partner_slug`** (slug-not-FK, per the favorite/005 pattern) — partner-type
  agnostic, so museums/restaurants/ATV/rafting are config, not schema.
- **`ref_code`** — unique, human-readable (`BW26-7Q3K9F`), DB-defaulted as a
  safety net; the client always supplies one so the interstitial can show it.
- **`status`** — the 5 observable states (`clicked`→…→`stayed`/`no_match`/`cancelled`).
- **timestamps** — `created_at`; reconciliation stamps `matched_at` later.
- **member linkage** — `user_id` + `itinerary_id` (both null for anonymous).
- **journey context** — provenance (utm/referrer/device/landing_page/dates) from
  006, **plus** the M7 snapshot (below).

**Immutability (Phase 3):** enforced by the grant model, not a new rule — clients
hold `SELECT, INSERT` only (no UPDATE/DELETE); `bi_insert` allows the insert.
A row cannot be altered from the browser once written. The snapshot is set once.

---

## 3. Referral flow (Phase 2)

`/go/[partner]` is one prerendered, `noindex` page per partner
(`getStaticPaths` over `PARTNER_SLUGS`) — **no SSR**, `<noscript>` direct link so
a booking is never blocked. `GoRedirect` (client:only) runs the funnel:

1. Resolve partner (unknown → redirect home), mint `ref_code`, build destination URL.
2. Emit `partner_interstitial_view` + `partner_referral`.
3. **Journey snapshot** — for signed-in members only: `getSession` → `getTrip` +
   `getFavoriteSlugs`, raced against `CONTEXT_CAP_MS` (2.5 s) and wrapped
   fail-open. Anonymous clicks stay empty.
4. `recordBookingIntent` (best-effort). On a **successful** Supabase insert →
   `booking_intent_created`.
5. Staged progress + code; then `partner_redirect` → `window.location.replace`.

**Fail-open is absolute:** `REDIRECT_CAP_MS` (6 s) guarantees hand-off regardless
of insert or context latency; every added read is time-boxed and cannot delay it.

---

## 4. Partner configuration (Phase 4 — offline-first)

Config stays in TypeScript (`src/data/partners.ts`) — no runtime config DB.
Adding a partner is **one entry**; `getStaticPaths` emits its `/go` route
automatically — **no routing change**. `type: PartnerType`
(`hotel|museum|restaurant|atv|rafting|attraction`) is descriptive only (groups the
dashboard, labels the interstitial) — **no code branches on it**, so a new partner
type needs zero engine changes. The `offerConfirmed` gate still withholds the
promo code/offer until the partner honors it; attribution records regardless.

Public fields only live here; commission %/report email stay server-side in
`partner` (006), never anon-readable.

---

## 5. Analytics (Phase 5)

Four events, each fired **exactly once**, in funnel order, payloads below:

| Event | When | Key payload | Guarantees |
|---|---|---|---|
| `partner_interstitial_view` | interstitial rendered | `partner`, `ref_code` | once (mount) |
| `partner_referral` | referral click begins | `partner`, `partner_type`, `ref_code`, `has_dates`, `party_size` | once (mount) |
| `booking_intent_created` | **successful** insert only | `partner`, `ref_code`, `is_member` | **not** emitted on skip/failure |
| `partner_redirect` | just before hand-off | `partner`, `ref_code` | once (guarded by `doneRef`) |

- **No duplicates** — view/referral fire once on mount; `partner_redirect` is
  guarded by the same `doneRef` that prevents a double navigation (button + timer).
- **No events after failures** — `booking_intent_created` is gated on
  `result.ok && result.via === 'supabase'`; a skipped (unconfigured) or errored
  insert emits nothing, while the redirect (and its event) still happens.
- `track()` is a no-op until GA4 (`gtag`) is provisioned, so nothing fires early.

---

## 6. Operational dashboard (Phase 6)

`booking_intent` is service_role-only by design, so the dashboard is generated
**off the browser** — no exposed endpoint, no SSR, no service-role key in the
build:

```
PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/booking-report.mjs
→ reports/booking-report.html   (gitignored; rows carry member UUIDs)
```

Shows: total clicks · Pass vs anonymous · partners · **clicks by partner** ·
**booking-intent status** · **top landing pages** · **referral history** (recent
200: when, partner, ref code, status, member/anon, dates, saved/interest counts,
itinerary flag, device, UTM source). Self-contained, theme-aware HTML with empty
states. **No financial reconciliation** — operational only, by design.

---

## 7. Verification checklist

**Offline (this session):**

- [x] `npm run verify` — **build ✓ · typecheck ✓ · lint ✓ · format:check ✓**
  (see §9 for numbers).
- [x] **Visual regression 12/12 ✓** — `/go` and the report are noindex / non-
  snapshot; public pages unchanged.
- [x] Referral codes generated — `generateRefCode` (unambiguous base32, `BW26-…`).
- [x] Redirect works + fails open — `REDIRECT_CAP_MS`, `<noscript>`, unknown-partner
  → home; all reads time-boxed.
- [x] Analytics — 4 named events, deduped, success-gated (§5).
- [x] Dashboard renders — script builds valid self-contained HTML incl. empty state.

**Live database (pending — not runnable in this session):**

- [ ] Apply `008`; `npm run verify:db` green (now asserts `booking_intent`,
  `hotel_report`, `bi_insert`, anon INSERT allowed, anon SELECT = 0 rows, anon
  cannot forge `user_id`).
- [ ] Click `/go/best-western-vernal?checkin&checkout&guests` → a `booking_intent`
  row with correct `ref_code`, provenance, and (as a member) the journey snapshot.
- [ ] Anonymous vs member: `user_id` null vs set; snapshot empty vs populated.
- [ ] Run `booking-report.mjs` against the live DB → the click appears.
- [ ] GA4 DebugView shows the 4 events with correct payloads and no duplicates.

---

## 8. Known limitations

1. **Snapshot depth** — `saved_slugs`/`interests` come from the member's saved
   trip/favorites; a not-yet-saved in-session selection isn't captured (no such
   state is persisted to read). Acceptable — attribution never depends on it.
2. **`landing_page` = `document.referrer`** — the page the click came from; a
   direct hit to `/go` records none. `referrer` (external) stays null unless passed.
3. **Dashboard is pull, not live** — staff run the script on demand. A hosted
   live page would need a Worker + auth (deferred; the offline report was chosen
   for zero new runtime surface).
4. **Reconciliation still deferred** — matcher script + revenue/commission columns
   wait for the first real partner CSV ([architecture §5/§6](PARTNER_REFERRAL_ARCHITECTURE.md)).

---

## 9. Verification run (offline)

- `npm run build` — ✓ 26 pages built
- `astro check` — ✓ 75 files, 0 errors / 0 warnings / 0 hints
- `eslint .` — ✓ 0 problems
- `prettier --check` — ✓ clean
- `playwright test` — ✓ 12/12 passed (public snapshots unchanged)
- `node --check scripts/booking-report.mjs` — ✓ parses

---

## 10. Business validation gate (revenue milestone)

M7 proves the *engine* works. **Attributable revenue** depends on the partner,
not the code — the gate from [architecture §7](PARTNER_REFERRAL_ARCHITECTURE.md)
must be closed with the Best Western GM before the numbers mean anything:

- [ ] Monthly reservation report available, including the **promo code**.
- [ ] Report includes **arrival date, room nights, confirmation number**.
- [ ] GM will **register `ADVENTURE`** and **honor** the check-in offer → then flip
  `partners.ts › offerConfirmed` to `true` (the only change needed to go live).

Until then: every click is still recorded and the dashboard still reports — the
engine is not blocked on the business conversation, only the commission math is.
