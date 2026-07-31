# ADR‑008 — Truth Gates Fail Closed

**Status:** Accepted · 2026‑07 · (implemented in `src/data/frontDeskInsights.ts`, `src/data/business.ts`, `src/data/rates.ts`)

## Context
The site publishes claims a guest will act on: rates, pet policy, drive times, whether a campground is
open. The cost of a wrong claim is not a bad impression — it is a guest who drives ninety minutes to a
closed gate, and a hotel that told them to. The cost of a *missing* claim is a shorter page.

Those costs are not symmetric, and the codebase already had two working precedents:

- `RATES` uses `null` to mean "not published" — a rate nobody confirmed has no path to a page.
- `BUSINESS.bookDirect[].confirmed` gates the discount CTA on an explicit human confirmation.

The editorial layer (front-desk insights) needed the same discipline, but it introduced a genuinely new
temptation: a partially-answered sheet. Ten good answers and one unreviewed one is exactly the case
where "publish what we have" feels reasonable.

## Decision
**An editorial claim renders only when every condition for publishing it is affirmatively satisfied.
Absence of a signal is treated as "do not publish," never as "assume fine."**

Concretely, in `publishableAnswer()` / `getPublishedRecord()`:

1. `reviewed`, `reviewedBy`, `reviewedOn` must all be present — the whole record is omitted otherwise.
2. `confidence` of `pending` or `na` never publishes.
3. `visibility` must be exactly `public` (see [ADR‑010](ADR-010-confidence-and-visibility-are-independent.md)).
4. A question marked `publishable: false` (e.g. `complaints`) never publishes, at any confidence.
5. When `personallyVerified` resolves to `false`, `basedOn` must name a source — research without a
   citation fails closed.
6. An empty answer string publishes nothing.

Each check drops that answer, not the build. A record whose answers all drop renders nothing at all —
`getPublishedRecord()` returns `null` and the component emits no markup.

**There is deliberately no override.** No `force: true`, no "publish anyway" flag. The way to publish
something is to review it.

## Consequences
- **Positive:** There is no mechanism by which a fabricated or unreviewed claim reaches the live site.
  That is a structural property, not a review habit — it survives a rushed edit and a future
  contributor who has not read this file.
- **Positive:** The gate is honest about partial work. A sheet with three reviewed answers publishes
  three answers; it does not pad the other eight.
- **Cost:** Silence is the failure mode. A typo in a `questionId`, or a forgotten `reviewedOn`, produces
  an empty page section with no error. This is mitigated — not solved — by `validateInsights()` and
  `scripts/verify-destination-pages.mjs`, which *report* these as issues. Anyone debugging a missing
  block should run the verifier first.
- **Cost:** Publishing requires a named human. That is the intended friction, and it makes content
  velocity a function of owner availability rather than engineering throughput. Accepted knowingly.
- **Boundary:** This applies to *truth and provenance*. It explicitly does **not** apply to maintenance
  scheduling — see [ADR‑009](ADR-009-freshness-never-blocks-publication.md), which decides the opposite
  for a deliberately different class of signal.

Relates to: [ADR‑001](ADR-001-repository-is-source-of-truth.md) (repo is truth),
[ADR‑009](ADR-009-freshness-never-blocks-publication.md),
[ADR‑010](ADR-010-confidence-and-visibility-are-independent.md).
