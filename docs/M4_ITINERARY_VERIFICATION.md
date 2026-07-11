# M4 — Itinerary Verification (Adventure Pass: Saved Adventures + Trip Planner)

**Date:** 2026-07-11 · **Branch:** `feature/m2-identity` · **Type:** offline (code + browser) verification
**Scope:** the first personalised experience inside the Adventure Pass — save attractions
(favorites), a **My Adventures** dashboard (saved / recently viewed / recommended next), a
deterministic **Trip Planner** (arrival · departure · interests → day-by-day itinerary), and
**Trip Status** (countdown · length · packing · season). Per [ROADMAP.md](ROADMAP.md) M4 and the
guardrails in [TECHNICAL_BASELINE.md](TECHNICAL_BASELINE.md).

> **Environment limitation (why some rows read BLOCKED, not PASS).** Same constraint as M1/M2: no
> `.env`, no live Supabase. Favorites and trip persistence are RLS-scoped writes that require an
> **authenticated session**, which cannot be minted headlessly (magic-link login needs a real inbox —
> [M2 §7](M2_IDENTITY_VERIFICATION.md)). Everything provable from code, types, and the pure
> deterministic logic was proven here (PASS); the live read/write round-trips are **BLOCKED — needs
> live project + session**, with the runbook in §7. Nothing below is assumed green.

> **Guardrail honoured:** no public page was touched. All M4 code ships **only** inside the existing
> `/pass` `client:only` island bundle and new `src/lib/*` modules. `BaseLayout`, `global.css`,
> `business.ts`, `_redirects`, `astro.config.mjs`, `build.format:'file'`, the 23 SEO pages, their URLs,
> metadata, JSON-LD, and the `.rv` reveal system are **unchanged**. No SSR, no AI, no maps, no new
> runtime dependency. Exactly **one** additive migration (`005_favorite.sql`); trip data reuses the
> existing `member_profile` and `itinerary` tables (no schema redesign).

---

## 1. Summary

| Area | Result |
|---|---|
| Attraction catalogue (`src/data/attractions.ts`, sourced from existing site copy) | ✅ PASS |
| Saved Adventures — favorites data layer (`favorites.ts`, RLS `fav_own`, optimistic UI) | ✅ PASS offline (code+types); ⏳ live write (§7) |
| My Adventures — saved / recently viewed / recommended, with empty states | ✅ PASS (offline, deterministic) |
| Trip Planner — deterministic itinerary generation | ✅ PASS (pure logic, exhaustively reasoned §4) |
| Trip persistence (`trip.ts` → `member_profile` + `itinerary`, one row/member) | ✅ PASS offline (code+types); ⏳ live write (§7) |
| Trip Status — countdown / length / days-remaining / season / packing | ✅ PASS (pure logic) |
| Analytics events (favorite_added/removed, trip_created/updated/deleted, itinerary_viewed) | ✅ PASS (offline; no-op until GA4 set) |
| Fails-open when Supabase unconfigured | ✅ PASS |
| Public pages unaffected (no gating, no URL/SEO change) | ✅ PASS |
| Live favorites/trip round-trip (save → reload → present) | ⏳ BLOCKED — needs live project + session (§7) |
| RLS isolation (member A cannot read member B's favorites/trip) | ⏳ BLOCKED — verify live via `verify:db` + §7 |

**Bottom line:** the M4 *code* is correct and safe on every axis provable offline — the planner and
status are pure deterministic functions, the data layer is typed and RLS-scoped, and it cannot harm
the public site (additive, fails open, no page gates). The live read/write round-trips and RLS
isolation remain for the operator to execute against the provisioned project (§7) before M4 sign-off.

---

## 2. Architecture (as built)

Client-only, islands-only — dictated by [TECHNICAL_BASELINE.md](TECHNICAL_BASELINE.md) §2. All M4 UI
lives inside the **single** `client:only` island already on `/pass` (`PassDashboard`); the new pieces
are child modules of that one bundle, so **zero** additional JS reaches the 23 static SEO pages.

**Data model — one additive migration; everything else reuses M1 tables.**

- [database/migrations/005_favorite.sql](../database/migrations/005_favorite.sql) — new `favorite`
  table `(user_id, attraction_slug, created_at)`, `unique(user_id, attraction_slug)`, RLS `fav_own`
  (own rows only), grants to `authenticated` / `service_role`. Self-contained in the 002/004 style.
- **Favorites key by attraction _slug_, not a `location` FK** — the `location` table is the not-yet-built
  Knowledge Base track and is intentionally empty; M4 must not block on it. Slugs are the stable
  contract shared with the catalogue. Documented, reversible migration path in the SQL header and
  [ADR-007](adr/ADR-007-attraction-catalogue-in-typescript.md).
- **Trip reuses existing columns/tables (no schema change):** `member_profile.arrival_date`,
  `.departure_date`, `.interests` (all present since 001, unused until now) hold the trip inputs;
  `itinerary.days` (jsonb, built for exactly this) holds the generated plan. One `itinerary` row per
  member (`saveTrip` updates if present, else inserts). `member_profile` writes are **partial upserts**,
  so the M2 profile fields (`user_types` / `visit_reason` / `marketing_optin`) are left untouched.

**Catalogue as a TS module** ([src/data/attractions.ts](../src/data/attractions.ts)) — 13 real Vernal
attractions with a shared interest taxonomy, lifted **verbatim** from copy already published on
`explore.astro` / `things-to-do-vernal-utah.astro` (no fabricated GPS or AI summaries). Same pattern
as `business.ts` for NAP. Single source of truth for favorites, recommendations, and the planner.

**Deterministic logic** ([src/lib/trip-plan.ts](../src/lib/trip-plan.ts)) — pure functions, no I/O and
no `Date.now()` inside (the caller passes "today"), so every output is reproducible and auditable:
- `generateItinerary(input)` — ranks attractions (favorite boost + interest overlap + editorial
  priority), then distributes them across days by a unit-budget model (full-day = 2 units, else 1),
  with arrival/departure days kept light and close to town, plus a downtown-dinner suggestion each
  evening in town. **Marked as the AI replacement seam for M5** (contract stays `PlanInput →
  ItineraryDay[]`; only the ranker/distributor is later swapped for grounded RAG).
- `tripStatus(arrival, departure, todayISO)` — phase (upcoming/in-progress/past), countdown, trip
  length, days remaining, season + note, and a season-aware packing list. No external APIs.

**Persistence & islands.**
- [src/lib/favorites.ts](../src/lib/favorites.ts) — `getFavoriteSlugs` / `addFavorite` (idempotent
  upsert) / `removeFavorite`; [src/lib/trip.ts](../src/lib/trip.ts) — `getTrip` / `saveTrip` /
  `deleteTrip`; [src/lib/destination.ts](../src/lib/destination.ts) — cached `vernal` id resolver;
  [src/lib/recently-viewed.ts](../src/lib/recently-viewed.ts) — client-only localStorage trail.
- Islands: `PassMemberHome` (state owner) → `PassMyAdventures`, `PassAdventureBrowser`,
  `PassTripPlanner` → `PassTripStatus`, plus shared `pass-ui.tsx`. Rendered inside `PassDashboard`'s
  authenticated member view (the profile form was folded into a `<details>` above it).
- Every function degrades gracefully when Supabase is unconfigured (returns `[]` / typed error) — the
  member UI never crashes and public pages, which never import this code, are unaffected.

---

## 3. Offline verification — quality gate

| Check | Result |
|---|---|
| `npm run build` | ✅ 25 pages built |
| `npm run typecheck` (`astro check`) | ✅ **67 files, 0 errors / 0 warnings / 0 hints** |
| `npm run lint` (eslint) | ✅ clean |
| `npm run format:check` (prettier) | ✅ clean |
| Visual regression (`npm run test:visual`) | ✅ **12/12** — home-mobile needed one retry (pre-existing hero-slideshow timing flake the spec documents; M4 ships **no** code to that page) |

`npm run verify` (build + typecheck + lint + format) passes end-to-end.

---

## 4. Deterministic itinerary — reasoned verification

The planner can't be exercised end-to-end headlessly (favorites live behind auth), but it is a **pure
function**, so its behaviour is fully determined by its inputs. Verified by reading the rules against
representative inputs:

| Input | Expected | Confirmed by code |
|---|---|---|
| Arrival Mon, departure Wed (2 nights), no interests, no favorites | 3 days; Day 1 (arrival) light & in-town + dinner; Day 2 an anchor full-day; Day 3 (departure) light, no dinner | `count = nights+1 = 3`; `dayBudget` = 1 for arrival/departure, 2 for middle; `areaAllowed` excludes `day-trip` on arrival/departure; dinner appended except on departure |
| No dates at all | A useful 3-day sample (never empty) | `count` falls back to 3 when `nights === null`; ranking always returns ≥12 attractions |
| interests = ['dinosaurs'] | Dinosaur NM / Field House / Red Fleet float to the top | `scoreOf` adds `overlap*10`; those three carry the `dinosaurs` tag |
| favorites = ['fantasy-canyon'] | Fantasy Canyon placed regardless of interest match | favorite boost = 1000 dominates the score |
| Same-day (arrival == departure) | 1 `single` day, budget 2, no departure suppression | `nights = 0 → count = 1`; role `single` |
| departure < arrival | Blocked before generation | `validate()` in `PassTripPlanner` returns an error; no write |
| 30-night trip | Capped at 14 days | `count = min(14, …)` |

**Trip Status** (`tripStatus`) verified the same way: `upcoming` (untilArrival > 0 → "N days to go" /
"Tomorrow"), `in-progress` (arrived, on/before departure → "day X of Y" + days remaining), `past`
(after departure → farewell, packing suppressed), `unknown` (no arrival → prompt for dates). Season is
derived from the arrival month; packing = base list + season list. All pure, no APIs.

> Formal unit tests are **not** added: the repo has no test runner installed and the baseline forbids
> unnecessary dependencies. The logic is isolated in pure functions specifically so a Vitest suite can
> be dropped in when a test runner is adopted — recommended follow-up, not a blocker.

---

## 5. Analytics — event catalogue (M4)

All via the shared `track()` helper ([src/lib/analytics.ts](../src/lib/analytics.ts)),
`{ transport_type: 'beacon' }`, **no-op until GA4 is configured**.

| Event | Trigger | Payload |
|---|---|---|
| `favorite_added` | heart tapped to save an attraction (after a successful write) | `{ slug }` |
| `favorite_removed` | heart tapped to unsave (after a successful write) | `{ slug }` |
| `itinerary_viewed` | member builds/regenerates their itinerary | `{ days }` |
| `trip_created` | first itinerary saved for the member | `{ days, interests }` |
| `trip_updated` | existing itinerary re-saved | `{ days, interests }` |
| `trip_deleted` | member clears their trip | `{}` |
| `trip_error` *(extra)* | a favorites/trip backend write failed | `{ reason: 'backend' }` |

All six required events are present; `trip_error` is an additional failure-signal bucket. Events fire
**only after** the corresponding write succeeds (optimistic UI reverts silently on failure).

---

## 6. Regression risk

**Very low, contained by design.**
- `/pass` is the only page importing any M4 code; it ships on **no** SEO page → CWV unaffected, visual
  regression **12/12** green. `/pass` is `noindex` and in no sitemap.
- **No schema redesign:** one additive table (`favorite`); trip data reuses `member_profile` /
  `itinerary` columns that already existed. `member_profile` writes are partial upserts → M2 profile
  data is never clobbered (the two writers touch disjoint columns).
- **No public gating:** nothing new requires login; the member surface fails open when Supabase is
  unconfigured or unreachable (returns empty state, never throws).
- **Additive & reversible:** reverting the M4 change removes the `/pass` member features with zero
  effect on public pages. The `favorite` table can be dropped with no impact on M1–M3 tables.
- **No new dependency, no SSR, no AI, no maps** — all deferred items untouched.

---

## 7. Live runbook (operator — execute against the provisioned project)

Prerequisites: M2 §7 completed (auth works live) + migration **005 applied** (`supabase db push`) +
`npm run verify:db` green. Sign in at `/pass` with a real magic link, then:

1. **Save an adventure:** tap ❤️ on an attraction in "Browse & save" → a row appears in `favorite`
   (Table editor) with your `user_id` + the slug. `favorite_added` in GA4 DebugView. **Screenshot.**
2. **Persistence:** reload `/pass` → the saved item is still under ❤️ Saved Adventures (read-back works).
3. **Unsave:** tap ❤️ again → the row is deleted; `favorite_removed` fires.
4. **Recently viewed:** click "Learn more →" on a couple of cards → they appear under 🕒 Recently
   Viewed (this is localStorage — per browser, **not** synced across devices; confirm it survives a
   reload but resets in a fresh/incognito browser).
5. **Build a trip:** set arrival + departure + a couple of interests → "Build my itinerary" → a
   day-by-day plan renders; an `itinerary` row exists for your `user_id` with `days` populated, and
   `member_profile.arrival_date/departure_date/interests` are set. `trip_created` + `itinerary_viewed`
   fire. **Screenshot** the row.
6. **Update / persist:** change a date → "Update my itinerary" → same `itinerary` row updated (not a
   second row); `trip_updated` fires. Reload `/pass` → dates, interests, and plan are pre-filled.
7. **Trip Status:** with a future arrival, confirm the countdown ("N days to go"), trip length, season,
   and packing tiles render; set arrival ≤ today ≤ departure and confirm "day X of Y" + days remaining.
8. **Clear trip:** "Clear trip" → `itinerary` row deleted, dates cleared; `trip_deleted` fires.
9. **RLS isolation (critical):** as member B, confirm you cannot see member A's favorites or itinerary
   (Table editor shows only your own rows via the anon key; `npm run verify:db` covers the policy).
   Confirm the profile form's M2 data is intact after trip saves (no clobber).
10. **Fails-open:** point at a bad Supabase URL → `/pass` member sections degrade to empty/notice, no
    crash; public pages + lead form still work. Restore.

---

## 8. Unresolved issues & recommendations

1. **Live read/write + RLS isolation pending (§7.1–7.9)** — the only way to prove favorites/trip
   persistence and per-member isolation. Blocking for M4 sign-off.
2. **Recently Viewed is per-browser, not per-account** (localStorage, by design — no per-attraction
   routes exist to track server-side). On a shared device it is visible to the next user of that
   browser. Low sensitivity (browsing trail only), but note it; move to a DB table if it ever needs to
   sync across devices.
3. **No unit tests for the pure logic** — the repo has no test runner (baseline forbids unnecessary
   deps). The planner/status are isolated as pure functions precisely so a Vitest suite can be added
   when a runner is adopted. Recommended, not blocking.
4. **Catalogue is hand-maintained TS.** When the Knowledge Base milestone seeds `location`, migrate
   favorites/itinerary to `location` FKs (map by slug, backfill) and retire `attractions.ts` — see
   [ADR-007](adr/ADR-007-attraction-catalogue-in-typescript.md). Until then, keep slugs append-only.

## 9. Screenshots required (attach on live execution)
- `favorite` row(s) in the Table editor after a real save (§7.1)
- `itinerary` row with populated `days`, and `member_profile` dates/interests (§7.5)
- `/pass` member view: Saved Adventures + a generated itinerary + Trip Status (§7.5–7.7)
- GA4 DebugView showing the M4 events (§7.1/§7.5/§7.8)
