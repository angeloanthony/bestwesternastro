# M6 — Production Validation

**Objective:** certify that the completed M6 (Vernal Knowledge Base) behaves correctly
**against the live Supabase project** before any new functionality is added. No features,
no redesign, no scope change — validation only.

**Verdict: ❌ NOT production-ready — CONDITIONAL / BLOCKED ON DEPLOYMENT.**
M6 is fully implemented and offline-verified in the repo, but **it has not been deployed
to the live production project.** Migration 007 is not applied and the Knowledge Base seed
is absent from production (0 destinations, 0 locations, 0 edges). This is a deployment gap,
not a code defect — but it means M6 cannot be certified live today.

---

## Environment certified

| | |
|---|---|
| Branch | `feature/m2-identity` |
| HEAD | `a541871c6d3b60ecd0cb309eac5607e67defa6bd` |
| Live project (`.env`) | `https://exmckkegeulzvrnqljbp.supabase.co` |
| Auth used | anon publishable key (service-role key blank; no `SUPABASE_DB_URL`) |
| Date | 2026-07-12 |

⚠️ **The working tree was under active concurrent modification during validation** by a
separate M7/booking-attribution stream (see Finding B). Results below pin the offline gate
to the state at validation time; the **live-DB findings are independent of local tree state.**

## Status at a glance

| Area | Status | Evidence |
|---|---|---|
| Build (typecheck/lint/format) | ✅ PASS | `npm run verify` — 26 pages, `astro check` 0/0/0, ESLint + Prettier clean |
| Visual regression | ✅ PASS | `npx playwright test` — 12/12 (6 pages × desktop+mobile) |
| Catalogue file integrity | ✅ PASS | 48 slugs, 48 unique, 0 duplicates; compiles into the static build |
| Public grants / RLS posture | ✅ PASS (partial) | anon denied on `favorite`/`member_profile`/`itinerary`; can read public tables |
| **Migration 007 applied to prod** | ❌ **FAIL** | generator: `column location.emoji does not exist` |
| **Knowledge Base seeded in prod** | ❌ **FAIL** | `destination`=0, `location`=0, `location_edge`=0 |
| Catalogue regen vs live DB | ⛔ BLOCKED | cannot run until 007 + seed are deployed |
| `verify:db` (schema/RLS gate) | ⏳ Operator required | needs `SUPABASE_DB_URL` + `psql` (neither available here) |
| Adventure Pass auth flows | ⏳ Operator required | magic-link needs an email round-trip + browser session |
| Booking attribution | Not in scope | separate milestone (M7) — see Finding B |
| **Overall** | **❌ Conditional / Blocked** | deploy 007 + seed, then re-validate |

---

## 1. Migration verification — ❌ FAIL

Running the catalogue generator against the live project fails immediately:

```
$ node scripts/generate-catalogue.mjs
Query failed: column location.emoji does not exist
```

`emoji` is one of the columns **added by migration 007** (`007_location_fields.sql`).
Its absence proves **007 has not been applied to production.** The base `location`,
`destination`, and `location_edge` tables *do* exist (from migration 001 — queries return
`count=0` with no error, not "relation does not exist"), so the schema is partially
deployed: **001-era tables present, 007 catalogue columns missing.**

## 2. Seed verification — ❌ FAIL

Live row counts via the anon key:

| Table | Live count | Expected | Result |
|---|---|---|---|
| `destination` | **0** | 1 (`vernal`) | ❌ not seeded |
| `location` | **0** | 48 | ❌ not seeded |
| `location_edge` | **0** | populated | ❌ not seeded |
| `favorite` | anon denied | (RLS: member-only) | ✅ correct posture |
| `member_profile` | anon denied | (RLS: member-only) | ✅ correct posture |
| `itinerary` | anon denied | (RLS: member-only) | ✅ correct posture |

The seed files exist in the repo (`database/seed/001_destination.sql`,
`002_locations.sql`, `003_location_edges.sql`) but **have not been applied** to the live
project. The committed `attractions.generated.ts` (48 locations) was therefore generated
against a **different database** (local Supabase, per `docs/LOCAL_SUPABASE_SETUP.md`), not
production.

The anon denials on the three member tables are the **expected** behaviour and a positive
signal: grants (migration 004) and RLS (002) are live and correctly scoped.

## 3. Catalogue verification — ✅ file integrity / ⛔ live regen blocked

The **committed** `src/data/attractions.generated.ts` is internally sound:

- 48 slugs, **48 unique, 0 duplicates**
- Compiles cleanly (part of the green `astro check`)
- `md5 = 4868c1e8062d54c9a41505e994bd2f85`

**Determinism against production could NOT be verified** because a regen requires the live
schema + seed that are not deployed. ⚠️ An earlier apparent "byte-identical, deterministic"
result was a **false positive**: the generator crashed on the missing `emoji` column
*before* writing the file, so the file was unchanged for the wrong reason. Once production
is seeded, re-run the generator and confirm an empty `git diff` to close this out.

The "13 legacy slugs preserved verbatim" contract (ADR-007) is asserted by the generated
file header and enforced offline (green typecheck → favorites/itinerary resolve by slug);
a live diff to prove it against production remains **pending deployment**.

## 4. Build statistics

| Metric | Value |
|---|---|
| Static pages built | 26 |
| `astro build` | 4.91s (26 pages in ~5.06s) |
| `astro check` | 74 files — 0 errors, 0 warnings, 0 hints |
| ESLint | clean |
| Prettier | clean |
| `npm run verify` wall-clock | ~34s |

## 5. Visual regression — ✅ 12/12

`npx playwright test` — **12 passed (29.7s)**, compare-only (snapshots **not** updated).
Coverage: home, things-to-do, extended-stay, workforce-housing, corporate-rates, 404 —
each desktop + mobile. No visual regressions.

## 6. Performance

| Metric | Value | Note |
|---|---|---|
| Catalogue generation | n/a (failed vs prod) | ~3.2s to reach the query error |
| Build time | ~5s / 26 pages | no regression |
| `dist/` total | 25 MB | dominated by images/video, not code |
| Client JS (all islands) | 305 KB total | largest: `jsxRuntime` 206.8 KB (shared), `PassDashboard` 45.7 KB |
| M6 client-JS impact | **~0 KB** | the catalogue is baked into static HTML; M6 ships no island |

M6 adds no client-side JavaScript — the Knowledge Base compiles into static pages (ADR-007),
so browse never depends on a live query and never fails-closed on a DB outage.

## 7. Findings

- **Finding A — Roadmap milestone numbering is stale (documentation).**
  `docs/ROADMAP.md` still lists `M3=Knowledge Base, M5=Concierge AI, M6=Beta Ready`, but
  this milestone, memory, and `docs/M6_KNOWLEDGE_BASE_VERIFICATION.md` treat **Knowledge
  Base as M6 / Production Hardening as M5**. *Recommendation: resolve after validation as a
  project-management task; not changed here (renumbering is not validation).*

- **Finding B — M6 and booking-attribution are fused in one commit (git hygiene).**
  Commit `a7dca0f "k"` contains M6 files (`002_locations.sql`, `attractions.generated.ts`,
  `attraction-types.ts`) **and** booking files (`006_booking_intent.sql`, `partners.ts`,
  `referrals.ts`, `go/[partner].astro`) together. Clean isolation now requires a history
  rewrite. During this validation the tree was **still being actively modified** by the
  booking/M7 stream (`008_booking_journey.sql`, journey fields). *Recommendation: split
  `a7dca0f` into M6 and M7 commits; keep the streams separate going forward.*

- **Finding C — Predicted generated-file header drift did NOT occur.** No action.

- **Finding D — 🔴 CRITICAL: migration 007 not applied to production.** (§1) Blocks
  certification.

- **Finding E — 🔴 CRITICAL: Knowledge Base seed not applied to production.** (§2) Blocks
  certification.

## 8. Operator-required checks + runbook

These could not be executed from this environment. Complete them to finish certification:

**Step 1 — Deploy M6 to production (unblocks Findings D & E):**
```
# apply migrations through 007 to the live project
supabase db push        # or psql -f each of 001..007 against the prod DB
# seed the Knowledge Base
psql "$SUPABASE_DB_URL" -f database/seed/001_destination.sql
psql "$SUPABASE_DB_URL" -f database/seed/002_locations.sql
psql "$SUPABASE_DB_URL" -f database/seed/003_location_edges.sql
```

**Step 2 — Re-run the objective checks (should now pass):**
```
PUBLIC_SUPABASE_URL=... PUBLIC_SUPABASE_ANON_KEY=... node scripts/generate-catalogue.mjs
git diff --stat src/data/attractions.generated.ts   # expect EMPTY (deterministic)
# live counts: destination=1, location=48, location_edge>0
```

**Step 3 — `verify:db` schema/RLS gate:** set `SUPABASE_DB_URL` (session-pooler URI) and
install `psql`, then `npm run verify:db` — **or** paste `database/tests/schema_checks.sql`
and `rls_checks.sql` into the Supabase SQL editor and confirm every line prints `PASS`.

**Step 4 — Adventure Pass live flows (human-in-the-loop, needs a real inbox):**
sign in via magic link → dashboard loads → save a favorite → reload (survives) →
logout/login (survives) → generate itinerary → save → reload (survives). Capture
screenshots of the signed-in dashboard for the record.

## 9. Production readiness assessment

**M6 is CODE-COMPLETE and OFFLINE-VERIFIED, but NOT DEPLOYED — therefore NOT
production-ready.** The build, catalogue integrity, and visual surface all pass; the live
Knowledge Base does not exist yet. Certification is **conditional** on completing Steps 1–4
above and re-running this validation to flip Findings D & E green.

## 10. Recommendation for M7

**Do not advance M7 feature work until M6 is deployed and re-validated.** A concurrent
stream is already building M7 booking-attribution (`008_booking_journey.sql`, journey
snapshot) on top of an M6 that is not live — repeating the exact pattern this milestone
caught (looks done in-repo, absent in production). Before M7:
1. Deploy + re-validate M6 (Steps 1–2), flip D & E green.
2. Run the `verify:db` gate live (Step 3).
3. Split the fused commit (Finding B) so M6 and M7 have independent, auditable history.
4. Then resume M7 against a certified M6 baseline.
