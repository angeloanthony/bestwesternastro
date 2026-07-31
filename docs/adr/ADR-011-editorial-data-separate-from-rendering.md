# ADR‑011 — Editorial Data Is Stored Independently of Page Rendering

**Status:** Accepted · 2026‑07 · (implemented as `src/data/frontDeskInsights.ts` → `src/components/FrontDeskInsight.astro`)

## Context
Every other approach to local knowledge on this site put the knowledge *in the page* — hand-authored
copy in `hotel-near-ashley-national-forest.astro`, a paragraph in `explore.astro`. That is how the 22
divergent `lastUpdated` strings happened: when a fact lives in markup, there is no place to record who
verified it, when, or whether it may be published, so those things simply are not recorded.

It also makes the knowledge page-shaped. But knowledge is about a **place**, not a URL. What the front
desk knows about Split Mountain is equally true on the Dinosaur National Monument page and the
things-to-do page, and it does not stop being true if a page is renamed.

## Decision
**Editorial knowledge is a typed record keyed by subject; pages subscribe to it.**

1. Records live in `src/data/frontDeskInsights.ts` as `InsightRecord`, keyed by a stable, append-only
   `subject` id — the same durable-contract pattern as attraction slugs
   ([ADR‑007](ADR-007-attraction-catalogue-in-typescript.md)).
2. A record declares which `pages` may render it. **One subject can appear on several pages**; the
   relationship is many-to-many and the record owns it, not the page.
3. Pages call `getPublishedInsights(pageSlug)` / `getPublishedInsightsForPage(pageSlug)` and render
   whatever comes back. **A page must render correctly when that returns nothing** — an unreviewed
   subject means an absent section, not a broken layout.
4. `FrontDeskInsight.astro` is presentation only. It applies no editorial logic: every gate has already
   run in the data layer ([ADR‑008](ADR-008-truth-gates-fail-closed.md)), so a component cannot
   accidentally widen what is publishable.
5. Validation (`validateInsights()`, `scripts/verify-destination-pages.mjs`) runs against the data, not
   the rendered HTML, so it is meaningful before a build exists.

This mirrors `business.ts` (NAP), `rates.ts` (pricing), and `attractions.ts` (catalogue). The editorial
layer is the fourth instance of one pattern, not a new one.

## Consequences
- **Positive:** Provenance has somewhere to live. Confidence, visibility, reviewer, review date, and
  source are properties of the *fact*, which is the only place they are meaningful.
- **Positive:** Adding knowledge to a page is a data edit, not a template edit — the workbook →
  publication path needs no engineering step.
- **Positive:** Pages become interchangeable consumers, so the Ashley standard can be applied to the
  next page without re-solving anything.
- **Cost:** Indirection. Reading `hotel-near-ashley-national-forest.astro` no longer tells you what the
  page says; you must also read the record. Accepted — the same trade already made for NAP and rates.
- **Cost:** Two representations of a place exist (`attractions.generated.ts` and an `InsightRecord`),
  joined by `catalogueSlugs`. The verifier cross-checks the join. `InsightRecord` is deliberately wider
  than the catalogue — `kind` covers `facility`, `venue`, and `region`, none of which are catalogue
  entries.
- **Boundary:** This is the last layer. Knowledge → typed record → validation → component → page is
  complete; a further abstraction between them needs a demonstrated problem, per the architecture freeze.

Relates to: [ADR‑001](ADR-001-repository-is-source-of-truth.md),
[ADR‑007](ADR-007-attraction-catalogue-in-typescript.md) (stable-slug contract),
[ADR‑008](ADR-008-truth-gates-fail-closed.md) (gates live in the data layer).
