# Architecture Decision Records

Short records of significant, hard‑to‑reverse decisions for AdventureOS. Each answers "why did we do it this way?" so the reasoning survives past the conversation that produced it.

**Format:** Title · Status · Context · Decision · Consequences. Keep them to a page or two.
**Rule:** never rewrite a superseded ADR — set its status to `Superseded by ADR‑NNN` and add a new one.

| # | Title | Status |
|---|---|---|
| [001](ADR-001-repository-is-source-of-truth.md) | Repository is the Source of Truth | Accepted |
| [002](ADR-002-preserve-flat-html-urls.md) | Preserve Flat‑HTML URLs (`build.format:'file'`) | Accepted |
| [003](ADR-003-adopt-supabase.md) | Adopt Supabase over a FastAPI Stack | Accepted |
| [004](ADR-004-tailwind-without-preflight.md) | Add Tailwind Without Preflight | Accepted |
| [005](ADR-005-ai-scope-limited-to-vernal.md) | AI Concierge Scope Limited to Vernal | Accepted |
| [006](ADR-006-passwordless-identity.md) | Passwordless, Magic-Link Identity | Accepted |
| [007](ADR-007-attraction-catalogue-in-typescript.md) | Attraction Catalogue in TypeScript; Favorites Keyed by Slug | Accepted |
| [008](ADR-008-truth-gates-fail-closed.md) | Truth Gates Fail Closed | Accepted |
| [009](ADR-009-freshness-never-blocks-publication.md) | Freshness Never Blocks Publication | Accepted |
| [010](ADR-010-confidence-and-visibility-are-independent.md) | Confidence and Visibility Are Independent Axes | Accepted |
| [011](ADR-011-editorial-data-separate-from-rendering.md) | Editorial Data Is Stored Independently of Page Rendering | Accepted |
| [012](ADR-012-one-hotel-entity-one-id.md) | One Hotel Entity, One `@id` | Accepted |

**008–011 are the editorial system.** They were written together and are best read in order: 011 says
where knowledge lives, 010 says what is recorded about it, 008 says what may publish, 009 says what is
reported but never enforced. Each records a rejected alternative that will look attractive again later.

See also: [`../TECHNICAL_BASELINE.md`](../TECHNICAL_BASELINE.md) — the project's reference contract.
