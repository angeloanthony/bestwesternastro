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

See also: [`../TECHNICAL_BASELINE.md`](../TECHNICAL_BASELINE.md) — the project's reference contract.
