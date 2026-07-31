# ADR‑010 — Confidence and Visibility Are Independent Axes

**Status:** Accepted · 2026‑07 · (implemented as `Confidence` / `Visibility` in `src/data/frontDeskInsights.ts`, mirrored in `docs/BUSINESS_KNOWLEDGE_WORKBOOK.md`)

## Context
The workbook collects answers from people at the property. Two different questions get asked of every
answer, and the natural instinct is to collapse them into one "status" field:

- **Is it true?** — traceable to a document, approved by management, known from the front desk, or
  merely believed.
- **May we publish it?** — website, given to a caller who asks, staff-only, or contractually protected.

Collapsing them breaks immediately on real content. "Halliburton crews stay here" can be fully
`verified` — the folios prove it — and strictly `confidential`, because naming a corporate client on a
public page is a business risk and possibly a contract breach. A single axis forces a choice between
**recording** that knowledge and **protecting** it, and the recorded-and-protected quadrant is where a
lot of the property's most valuable operational knowledge lives.

The inverse quadrant is just as real: a front-desk answer about parking can be `public` in intent but
`pending` in confidence. It should not publish — for a completely different reason.

## Decision
**Two orthogonal enumerations, both required, neither derivable from the other.**

- `Confidence`: `verified` · `gm-approved` · `local-knowledge` · `pending` · `na`
- `Visibility`: `public` · `on-request` · `internal` · `confidential`

Both are set per-record with per-answer overrides. Publication requires passing **both** independently:
confidence not in {`pending`, `na`}, **and** visibility exactly `public`. Neither implies the other, and
no code infers one from the other.

`personallyVerified` + `basedOn` is a third, related-but-separate distinction — observation vs. research
— because staff who have stood in the parking lot know something a Forest Service PDF cannot tell them,
and the reader deserves to know which one they are reading. It is a *provenance* attribute, not a
confidence level, which is why it is not folded into the `Confidence` enum.

`ReviewCycle` ([ADR‑009](ADR-009-freshness-never-blocks-publication.md)) is the fourth axis: *when does
this stop being true?*

## Consequences
- **Positive:** The knowledge base can hold everything the property knows, including what it must never
  publish. Confidential knowledge is captured rather than omitted — and `complaints`
  (`publishable: false`) is captured for the same reason: it tells the front desk what to pre-empt at
  check-in, and publishing it would be self-harm.
- **Positive:** The two failure modes stay distinguishable in the audit output. "Not published because
  unverified" and "not published because confidential" call for opposite follow-up actions.
- **Cost:** More fields to fill in, and the workbook must teach the distinction to non-technical staff.
  Mitigated by mirroring the same two columns on the paper instrument, so the vocabulary is learned once.
- **Cost:** Two enums can drift from the workbook's wording. The stable `questionId` contract and the
  verifier limit this; the workbook is the source of truth for wording.

**If someone later proposes merging these into one status field, this ADR is the answer.** The test
case is: where does "verified, and contractually confidential" go?

Relates to: [ADR‑008](ADR-008-truth-gates-fail-closed.md) (both axes are fail-closed gates),
[ADR‑009](ADR-009-freshness-never-blocks-publication.md) (the freshness axis).
