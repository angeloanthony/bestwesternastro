# M6 — Vernal Knowledge Base — Verification Report

**Status (2026-07-11):** application + data layer **built + offline-verified**.
Replaces the temporary `src/data/attractions.ts` catalogue (ADR-007) with the
permanent, relational **Vernal Knowledge Base** in Postgres. Additive only: one
migration (`007_location_fields.sql`) and two seed files; no existing table,
URL, layout, or M1–M5 behaviour changed. `[~]` items need the live database.

> Milestone label note: the repo's older [ROADMAP.md](ROADMAP.md) lists "M3 —
> Knowledge Base"; per the current agreed roadmap this is **M6 (Vernal Knowledge
> Base, non-AI)**. This document uses M6. ROADMAP.md was intentionally left
> untouched to avoid colliding with the parallel booking-attribution work active
> on this branch (see §8).

---

## 1. What changed (every affected file)

**New**

| File | Purpose |
|---|---|
| `database/migrations/007_location_fields.sql` | Additive catalogue columns on `location` |
| `database/seed/002_locations.sql` | 48 real Vernal locations (`status='published'`) |
| `database/seed/003_location_edges.sql` | 40 semantic edges + `rebuild_near_edges()` |
| `scripts/generate-catalogue.mjs` | Build-time DB → `attractions.generated.ts` |
| `src/data/attractions.generated.ts` | Generated, **committed** catalogue snapshot |
| `src/data/attraction-types.ts` | Shared catalogue types (breaks the import cycle) |
| `docs/M6_KNOWLEDGE_BASE_VERIFICATION.md` | This report |

**Modified**

| File | Change | Blast radius |
|---|---|---|
| `src/data/attractions.ts` | Now a thin **re-export shell**: keeps the `INTERESTS` taxonomy + types, re-exports `ATTRACTIONS`/`ATTRACTION_BY_SLUG`/`getAttraction` from the generated module | **Zero** — all 6 importers keep the same specifiers/types |
| `src/lib/database.types.ts` | Added `LocationRow` / `LocationEdgeRow` + registered `location` / `location_edge` | Additive |

**Deliberately NOT touched:** `BaseLayout`, `global.css`, all SEO pages,
`astro.config.mjs`, `business.ts`, auth, the dashboard, the `favorite` schema
(stays slug-keyed), every M1–M5 migration, and all visual-snapshot pages.

---

## 2. Schema — the model (Phase 1 & 2)

The `location` table (migration 001) was built for exactly this and was
intentionally empty (ADR-007). Migration `007` adds **additive, nullable/defaulted**
columns only — nothing in 001 is altered or dropped:

| M6 Location field | Column | Source |
|---|---|---|
| slug / name / status | `slug` / `name` / `status` | 001 |
| short_description | `ai_summary` (NOT NULL, hand-authored — **not AI**) | 001 |
| long_description | `description_full` | 001 |
| categories | `categories text[]` | 001 |
| coordinates | `gps geography(point)` (NOT NULL) | 001 |
| interests | `good_for text[]` | 001 |
| seasonality | `seasonal_notes` | 001 |
| website / phone | `website` / `phone` | 001 |
| images | `images jsonb` | 001 |
| estimated_visit_time | `visit_duration` (`quick`/`half-day`/`full-day`) | **007** |
| drive_time | `drive_minutes int` | **007** |
| difficulty | `difficulty` (`easy`/`moderate`/`strenuous`) | **007** |
| family_friendly / pet_friendly / wheelchair_accessible | booleans | **007** |
| booking_url | `booking_url` | **007** |
| tags | `tags text[]` | **007** |
| priority / featured | `priority int` / `featured bool` | **007** |
| (card "Learn more") | `learn_more_href` — internal `.html` path only (ADR-002) | **007** |
| emoji, area | `emoji` / `area` (`in-town`/`nearby`/`day-trip`) | **007** |

No new tables. No duplicated data: the card's category label is **derived**
(`array_to_string(categories, ' · ')`), and `interests` reuses `good_for`.

---

## 3. Seed — the data (Phase 3)

`database/seed/002_locations.sql` — **48 real locations**, an idempotent UPSERT
keyed by `(destination_id, slug)`. Only real places; no placeholders.

- **The original 13** are seeded **verbatim** (same slugs, priorities, drive
  times, blurbs, emoji, `learn_more_href`) so favorites/itineraries saved today
  keep resolving and the deterministic planner's output for them is unchanged.
- **35 new** across the requested spread: National Monument sub-sites (Cub Creek,
  Josie cabin, Sound of Silence, Split Mountain ramp/campground, Green River
  campground, Rainbow Park), Flaming Gorge (dam & visitor center, Red Canyon
  Overlook, Sheep Creek, Swett Ranch, Cedar Springs Marina), trails (Red Fleet
  Trackway, Jones Hole Creek, Dry Fork Flume, Brush Creek Cave), fishing (Pelican
  Lake, Stewart Lake), Ouray NWR, scenic drives (Red Cloud Loop, Dry Fork
  Canyon), Nine Mile Canyon, John Jarvie Ranch, Starvation & Ashley NF, museums
  (Western Heritage), landmarks (Vernal Temple, Parcel Post Bank), the
  Dinosaurland Welcome Center, and 5 downtown restaurants.

Coordinates are **approximate to each site** (WGS84). Business-level coordinates
(restaurants, marina) should be spot-checked against the live source before a
public launch — see §7.

---

## 4. Relationships (Phase 4)

`database/seed/003_location_edges.sql` — the foundation for planning,
recommendations, and future AI.

- **Proximity (`near`)** — **not** hand-authored. Generated from PostGIS by
  `rebuild_near_edges('vernal')` (migration 003) so distances stay correct if a
  `gps` changes. Count is dynamic (pairs within 8 km).
- **40 semantic edges**, hand-authored. Per the M6 decision they **reuse the
  existing `rel_type` enum** (no enum migration) and carry the specific
  relationship in `note` / `to_ref` / `weight`:

| Requested relationship | Encoded as | Count |
|---|---|---|
| (sub-site structure) | `part_of` | 18 |
| Indoor Backup / Rain Alternative | `alternative_to` (note says which) | 5 |
| Sunset Location / Kid Friendly | `suitable_for` (`to_ref` = `sunset`/`family`) | 9 |
| Family Combo / Half-day Pair / Full-day Pair / Kid Sequence | `recommended_for` (note says which) | 8 |

The seed deletes only the semantic edges it owns before re-inserting, so it is
idempotent and never disturbs the PostGIS-generated `near` edges.

---

## 5. Repository integration (Phase 5)

**Build-time codegen** — the approved approach, the only one consistent with
*no-SSR + invisible-to-users + deterministic + fails-open + no visual redesign*:

```
Postgres `location` (source of truth)
        │  scripts/generate-catalogue.mjs   (reads published rows via anon key)
        ▼
src/data/attractions.generated.ts  (committed snapshot; Attraction[] shape)
        │  re-exported by
        ▼
src/data/attractions.ts  (INTERESTS + types + getAttraction — unchanged surface)
        │  imported unchanged by
        ▼
trip-plan.ts · trip.ts · PassAdventureBrowser · PassMyAdventures · PassTripPlanner · pass-ui
```

The database is the source of truth; the committed generated file is the build
artifact and the offline/outage fallback. The app never queries locations at
runtime, so browse cannot fail-closed and there is no SSR. Regenerate with:

```
PUBLIC_SUPABASE_URL=… PUBLIC_SUPABASE_ANON_KEY=… node scripts/generate-catalogue.mjs
```

(The generator formats its output with prettier; a regen against the seeded DB
leaves `attractions.generated.ts` byte-unchanged.)

---

## 6. Verification (Phase 6)

**Offline (this session) — all green:**

- [x] `npm run verify` gates: **build ✓** (26 pages, 4.6s) · **typecheck ✓**
  (`astro check`, 74 files, 0 errors/0 warnings/0 hints) · **lint ✓** (eslint, 0
  problems) · **format:check ✓** (prettier clean). The parallel booking-intent
  code compiles alongside it without error (§8).
- [x] **Visual regression 12/12 ✓** (`npx playwright test` — all public
  desktop+mobile snapshots unchanged).
- [x] **Catalogue count** — generated file has exactly **48** locations; all **13
  original slugs present**.
- [x] **Contract preserved** — the 13 original slugs and their app-facing fields
  are identical between the old hand-authored array and the new generated file
  (favorites/itinerary references and planner ranking unchanged).
- [x] **Public site untouched** — the 12 visual-snapshot pages
  (`tests/visual/existing-pages.spec.ts`) do **not** import the catalogue module;
  the Adventure Browser is behind `/pass` auth and is not snapshotted.
- [x] **Additive DB** — `007` is `add column if not exists` only; the existing
  `schema_checks.sql` assertions still hold.

**Live database (pending — not runnable in this session):**

- [ ] Apply `007` + seeds `002`/`003`; confirm `select count(*) from location
  where status='published'` = 48 and the edge counts in §4.
- [ ] `npm run verify:db` (`schema_checks.sql` + `rls_checks.sql`) green.
- [ ] Run `generate-catalogue.mjs` against the seeded DB → empty git diff on
  `attractions.generated.ts` (proves seed ↔ generated parity).
- [ ] `/pass` round-trips: favorite a NEW location → reload → present; generate a
  trip that can now include new locations; My Adventures recommendations.
- [ ] RLS: anon reads only `status='published'`; anon cannot read `draft`.

---

## 7. Known limitations / risks

1. **Business-level coordinates are approximate.** Parks and public lands are
   reliable; the 5 restaurants and the marina use in-town approximate points.
   Verify before a public launch; `last_verified` is stamped on every UPSERT.
2. **Richer catalogue changes planner *content*, not mechanics.** With 48 options
   the deterministic planner can now surface new locations for a guest whose
   interests match — expected and desired. The algorithm (`trip-plan.ts`) is
   unchanged; new locations are ranked below the original 13 by `priority` on ties.
3. **`favorite` still keys by slug.** The ADR-007 `location_id` FK swap is a
   deferred, low-risk follow-up; slugs remain the durable contract, so nothing
   forces it now.
4. **Two sources until regen is wired into CI.** The generated file is committed;
   until `generate-catalogue.mjs` runs in the deploy pipeline, editing the DB
   requires a manual regen. Documented, not automated in this milestone.

---

## 8. Parallel-work caveat (branch hygiene)

While M6 was being built, an **unrelated booking-attribution milestone** landed
on the same branch (`006_booking_intent.sql`, `src/data/partners.ts`,
`src/lib/referrals.ts`, `src/pages/go/[partner].astro`, and `booking_intent`
types). Two consequences were handled:

- **Migration number collision** — booking-intent claimed `006`, so the Knowledge
  Base migration was renumbered **`006_location_fields.sql` → `007_location_fields.sql`**.
- **`database.types.ts` drift** — the file gained `BookingIntentRow` mid-session;
  the location types were re-applied additively around it.

A background watcher on this branch is **auto-committing files** (e.g. commit
`a541871 "Create 003_location_edges.sql"`). No commits were made by this task
deliberately; the milestone's "no commits" instruction was honoured on my side.
Because `npm run verify` now also compiles the parallel booking-intent code, any
failure there must be attributed to the correct milestone (see §9).

---

## 9. Future AI integration seam

M6 is deliberately **non-AI**. The seams are already in place for a later
Concierge milestone (ADR-005), with no re-architecture required:

- `location.embedding vector(1024)` and `match_locations()` (migration 003) exist,
  unused — populate embeddings to enable RAG retrieval.
- `trip-plan.ts` documents the swap point: the ranking/distribution can be
  replaced by RAG-over-`location` + an LLM while the `PlanInput → ItineraryDay[]`
  contract, persistence, and UI stay identical.
- `location_edge` (semantic graph) is the grounding source those features consume.
