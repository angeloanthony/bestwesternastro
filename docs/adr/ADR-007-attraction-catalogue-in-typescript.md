# ADR‑007 — Attraction Catalogue in TypeScript; Favorites Keyed by Slug

**Status:** Accepted · 2026‑07 · (implemented in M4 — Itinerary)

## Context
M4 (Saved Adventures + Trip Planner) needs a stable set of Vernal attractions a member can favorite
and that the planner can arrange into days. The schema has a `location` table (migration 001) built
for exactly this kind of entity — but it is **intentionally empty**: populating it (with GPS, AI
summaries, embeddings, governance/`status`, and the relationship graph) is the **Knowledge Base**
track, a separate milestone that is not yet built. `location` also carries `NOT NULL` `gps` and
`ai_summary`, so seeding it for M4 would mean inventing coordinates and summaries — data we cannot
verify — just to unblock a favorites feature.

Meanwhile the real attraction content already exists on the site as hand-authored copy in
`explore.astro` and `things-to-do-vernal-utah.astro`.

## Decision
1. **The M4 attraction catalogue lives in a TypeScript module** — `src/data/attractions.ts` — the same
   "single source of truth in TS" pattern already used by `src/data/business.ts` for NAP. Every field
   is lifted **verbatim** from copy already published on the site; no GPS or AI summaries are
   fabricated. Each attraction has a stable, append-only `slug`.
2. **Favorites reference an attraction by `slug` (text), not a foreign key to `location`.** The new
   `favorite` table (migration 005) stores `attraction_slug`. The itinerary's `days` jsonb likewise
   references stops by slug.
3. This keeps M4 **independent of the unbuilt Knowledge Base** and requires exactly one small additive
   migration, with no fabricated data entering the database.

## Consequences
- **Positive:** M4 ships now without depending on a heavier, not-yet-built subsystem; no invented
  coordinates/summaries; the catalogue is trivially editable and reviewable in one file.
- **Positive:** Deterministic and testable — the planner/recommender read a static array, so their
  output is fully reproducible (supports the "no AI, deterministic rules" M4 requirement).
- **Cost:** The catalogue is hand-maintained and duplicates attraction *names* that also appear in the
  SEO pages' copy. Acceptable at 13 entries; revisit if it grows large.
- **Cost / migration path:** Two sources of attraction truth will exist once `location` is seeded. The
  planned resolution: when the Knowledge Base milestone seeds `location`, give each row a `slug`
  matching this file; add a nullable `location_id uuid references location(id)` to `favorite`, backfill
  by slug, then retire `attractions.ts`. The slug is the durable contract → **treat slugs as
  append-only** (never rename or reuse one) so favorites saved today keep resolving.
- **Reversibility:** additive and low-cost to unwind — the `favorite` table and `attractions.ts` can be
  dropped without touching any M1–M3 table.

Relates to: [ADR-001](ADR-001-repository-is-source-of-truth.md) (repo is truth),
[ADR-003](ADR-003-adopt-supabase.md) (Supabase schema). Superseded when the Knowledge Base seeds
`location` and favorites migrate to a `location_id` FK.
