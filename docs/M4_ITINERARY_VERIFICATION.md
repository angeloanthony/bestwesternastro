# M4 — Itinerary Verification (Adventure Pass: Saved Adventures + Trip Planner)

**Date:** 2026-07-11 · **Branch:** `feature/m2-identity` · **Type:** offline (code + browser) verification + production-hardening close-out

**Status legend (three levels).** To give future engineers real confidence instead of a binary
PASS/BLOCKED, every row is graded:

- **PASS** — verified against the live system (a real signed-in session round-trip).
- **AUDITED** — reviewed statically; implementation confirmed correct by reading the code, types, and
  pure logic. Ready for production verification, but not yet exercised end-to-end on live infra.
- **OPERATOR** — requires manual production verification (live browser session, a second account,
  and/or GA4 DebugView). An operational validation task, **not** an engineering blocker. The engineering
  implementation is AUDITED; the runbook is §7.

The backend round-trips (favorites INSERT/SELECT, RLS, REST 200s) were confirmed live during M4 testing.
The remaining live-only checks (persistence across refresh/logout, two-account RLS, GA4 event firing) are
**OPERATOR** items — recorded honestly here rather than marked PASS without live evidence.
**Scope:** the first personalised experience inside the Adventure Pass — save attractions
(favorites), a **My Adventures** dashboard (saved / recently viewed / recommended next), a
deterministic **Trip Planner** (arrival · departure · interests → day-by-day itinerary), and
**Trip Status** (countdown · length · packing · season). Per [ROADMAP.md](ROADMAP.md) M4 and the
guardrails in [TECHNICAL_BASELINE.md](TECHNICAL_BASELINE.md).

> **Why some rows read OPERATOR, not PASS.** RLS-scoped writes require an **authenticated session**,
> which cannot be minted from an engineering/headless context (magic-link login needs a real inbox —
> [M2 §7](M2_IDENTITY_VERIFICATION.md)). Everything provable from code, types, and pure deterministic
> logic is **AUDITED**; the backend write path was confirmed **PASS** live during M4 testing; the
> remaining browser/GA4/second-account checks are **OPERATOR** items with the runbook in §7. Nothing
> below is assumed green — OPERATOR is an explicit "verify in production," not a silent pass.

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
| Attraction catalogue (`src/data/attractions.ts`, sourced from existing site copy) | ✅ **PASS** (deterministic) |
| Saved Adventures — favorites data layer (`favorites.ts`, RLS `fav_own`, optimistic UI) | ✅ **PASS** — backend write/read confirmed live in M4 testing |
| Favorites — failed-write UX (friendly error, optimistic revert, duplicate-click guard) | 🔷 **AUDITED** — hardened this pass (§6a) |
| My Adventures — saved / recently viewed / recommended, with empty states | 🔷 **AUDITED** (deterministic; empty state improved §6a) |
| Trip Planner — deterministic itinerary generation | 🔷 **AUDITED** (pure logic, exhaustively reasoned §4) |
| Trip persistence (`trip.ts` → `member_profile` + `itinerary`, one row/member) | 🔷 **AUDITED** (code+types); backend path confirmed live |
| Trip Status — countdown / length / days-remaining / season / packing | 🔷 **AUDITED** (pure logic) |
| Analytics events (favorite_added/removed, trip_created/updated/deleted, itinerary_viewed) | 🔷 **AUDITED** — static audit §5; 🟠 **OPERATOR** — live GA4 firing |
| Fails-open when Supabase unconfigured | 🔷 **AUDITED** |
| Public pages unaffected (no gating, no URL/SEO change) | ✅ **PASS** — visual regression 12/12, `/pass` not snapshotted |
| Favorites/trip persistence across refresh + logout/login | 🟠 **OPERATOR** — needs live browser session (§7.2, §7.6) |
| RLS isolation (member A cannot read member B's favorites/trip) | 🟠 **OPERATOR** — needs second account + `verify:db` (§7.9) |

**Bottom line:** the M4 *code* is correct and safe on every axis provable in engineering — the planner
and status are pure deterministic functions, the data layer is typed and RLS-scoped, the backend write
path was confirmed live, and it cannot harm the public site (additive, fails open, no page gates,
visual regression 12/12). This close-out pass additionally **hardened the member UX and error handling**
(§6a) and **statically audited the analytics** (§5). The remaining browser/GA4/second-account checks are
**OPERATOR** items (§7) — production validation, not engineering blockers. **M4 is engineering-complete.**

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
| Visual regression (`npm run test:visual`) | ✅ **12/12** clean (no retry needed this run). The suite snapshots 6 public pages; `/pass` is not among them, so member-UI changes carry **zero** visual-regression risk |

`npm run verify` (build + typecheck + lint + format) passes end-to-end (re-run for this close-out:
build 25 pages, typecheck 67 files / 0 errors, lint clean, prettier clean).

> `npm run verify:db` (live DB gate) is **OPERATOR** — it needs a direct `SUPABASE_DB_URL` connection
> string, which is not present in the engineering `.env`. Run it with the pooler/direct string, or paste
> `database/tests/schema_checks.sql` + `rls_checks.sql` into the Supabase SQL editor (see §7.9).

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

All six required events are present; `trip_error` is an additional failure-signal bucket.

**Static audit (this pass) — findings against the four required properties:**

| Property | Result | Evidence (read against the code) |
|---|---|---|
| Correct event names | ✅ **AUDITED** | The six required names + `trip_error` match the table exactly; grepped every `track(` call site ([PassMemberHome.tsx](../src/islands/PassMemberHome.tsx), [PassTripPlanner.tsx](../src/islands/PassTripPlanner.tsx)). No typos, no stray events. |
| Correct payloads | ✅ **AUDITED** | `favorite_*` → `{ slug }`; `trip_created/updated` → `{ days, interests }`; `itinerary_viewed` → `{ days }`; `trip_deleted` → `{}`. Matches the table. |
| No duplicate firing | ✅ **AUDITED** | Each event has exactly one call site. The favorite duplicate-click guard (`if (saving.has(slug)) return`) prevents a second in-flight toggle, so no double `favorite_*`. `trip_created` vs `trip_updated` is mutually exclusive via `saveTrip`'s `outcome`. |
| No firing on failed writes | ✅ **AUDITED** | `favorite_added/removed` fire **only** inside the `result.ok` branch (after the write). `trip_created/updated` fire **only** after `saveTrip` returns ok; a failure fires `trip_error` instead and returns early. `trip_deleted` fires only after `deleteTrip` ok. |

**One documented nuance (not a defect):** `itinerary_viewed` fires when the plan is *generated client-side*
(before the persistence call), because it represents the member seeing their itinerary — which happens
regardless of whether the save round-trip succeeds. If a subsequent `saveTrip` fails, `itinerary_viewed`
will have already fired alongside `trip_error`. This is intentional (view ≠ save), but flagged here so the
GA4 analyst reading DebugView isn't surprised. **OPERATOR:** confirm live in GA4 DebugView (§7).

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

## 6a. Production hardening (M4 close-out pass)

Small, contained polish applied while closing M4 — no architecture, routing, schema, dependency, or
public-page change. Five files touched, all inside the `/pass` island bundle + docs.

**UX polish** ([pass-ui.tsx](../src/islands/pass-ui.tsx), [PassMyAdventures.tsx](../src/islands/PassMyAdventures.tsx))
- **Unsaved heart is now clearly visible.** The bare `🤍` emoji was near-invisible on the white
  attraction card (it cost real time to spot during live testing — a genuine usability bug). Replaced
  with an **inline outlined SVG heart** (navy `#1a2e52` stroke, no fill); saved state is a **filled gold
  `#c9a84c` heart** so saved/unsaved read at a glance. Inline SVG → no new dependency.
- **Larger hit area** — the button padding grew (`p-2.5`, 28px icon) for an easier tap target.
- **Hover tooltip** — `title="Save to your Adventure Pass"` (and "Saved … — tap to remove" when saved).
- **a11y preserved** — `aria-pressed`, dynamic `aria-label`, `aria-hidden` on the decorative SVG.
- **Empty Saved Adventures state** is now an encouraging dashed-border call-to-action panel instead of a
  muted sentence.

**Error handling** ([PassMemberHome.tsx](../src/islands/PassMemberHome.tsx))
- **Failed favorite writes are no longer silent.** Previously a failed save/remove reverted the heart
  with **no explanation** — the user just saw it pop back. Now a failure surfaces a friendly, live-announced
  notice ("Couldn't save this adventure. Please try again."), the optimistic UI still reverts, and the
  notice clears on the next attempt. Trip-planner writes already had loading/disable/error/revert handling;
  this closes the one gap.
- Every Supabase mutation now: shows loading state (button disabled while in flight), guards duplicate
  clicks (`saving` set for favorites; `status==='working'` for trips), reverts optimistic UI on failure,
  and shows a friendly message. No path leaves the UI in an inconsistent state.

Verification for this pass: `npm run verify` green (build 25 / typecheck 0 errors / lint / prettier),
`npm run test:visual` **12/12**. Live favorite/trip behaviour remains OPERATOR (§7).

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

1. **Live persistence + RLS isolation are OPERATOR items (§7.1–7.9)** — the backend write path was
   confirmed live in M4 testing; the remaining browser round-trips (persistence across refresh/logout),
   two-account RLS isolation, and GA4 event firing require a live session / second account / DebugView.
   These are **operational validation, not engineering blockers** — M4 is engineering-complete and these
   run against the deployed environment.
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

---

## 10. Lessons learned (first live deployment)

Operational lessons earned bringing the Adventure Pass up on live Supabase — recorded so the next live
milestone doesn't re-learn them:

- **PostgREST's schema cache can briefly lag after creating/altering tables.** A freshly created table or
  column may 404/PGRST20x from the REST API for a short window until the cache reloads. If a brand-new
  table looks "missing," give it a moment (or reload the schema cache) before assuming a code defect.
- **The Supabase SQL Editor runs as `postgres`, not as a member.** `auth.uid()` there is **not**
  representative of a browser session — RLS policies that look "broken" in the SQL editor often work
  correctly under a real anon-key session, and vice-versa. Test RLS with the anon key / a real login, not
  the SQL editor.
- **Verify the REST endpoint before assuming a frontend bug.** A failing save is far more often a
  database/RLS/schema-cache issue than an island bug. Confirm the REST call returns 200 with the expected
  row before touching the UI code. (This pass's silent-favorite-error fix exists precisely so the UI now
  *tells you* when the write failed instead of hiding it.)
- **Production debugging order:** **Database → REST → Authentication → UI.** Walk it in that direction:
  confirm the row/policy in the DB, then the REST endpoint, then the session/token, and only then the
  component. Most "the button doesn't work" reports resolve in the first two layers.
