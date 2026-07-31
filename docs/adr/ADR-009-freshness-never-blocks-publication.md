# ADR‑009 — Freshness Never Blocks Publication

**Status:** Accepted · 2026‑07 · (implemented as `ReviewCycle` / `freshnessReport()` in `src/data/frontDeskInsights.ts`)

## Context
`ReviewCycle` was added on observed drift, not anticipated need: 22 pages hand-typed the same
`lastUpdated` string, the homepage disagreed with them, and `BUSINESS.lastUpdated` agreed with neither.
The workbook's §8 already *promises* an annual review; nothing enforced it. That is the same decay
`rates.ts` was built to end.

Once a review clock exists, the obvious next move is to wire it into the publication gate the way
[ADR‑008](ADR-008-truth-gates-fail-closed.md) wires everything else: overdue content stops rendering.
That move was considered and rejected.

## Decision
**Freshness is reported, never enforced.** `freshnessReport()` classifies records as current / due /
overdue and the verifier prints them. `getPublishedRecord()` does not consult freshness at all. An
overdue record keeps rendering exactly as before.

The reasoning is that freshness and truth are different claims:

| Class | Question | What a failure means | Behavior |
|---|---|---|---|
| Truth / provenance | Is this true, and who says so? | Wrong information could be published | **Fail closed** |
| Maintenance | Might this have changed? | A human should look again | **Report only** |

An overdue `seasonal` answer is not *known* to be wrong. It is known to be *unchecked*. Deleting content
because nobody looked at it recently punishes the site for an operational lapse, and it does so silently,
at the moment traffic is highest.

The decisive argument is incentive design. If an overdue cycle unpublished content, the cheapest fix
would not be to review the content — it would be to set `reviewCycle: 'never'`. A gate that can be
disarmed by editing one word teaches people to disarm it, and takes the audit signal down with it.
Keeping the report non-blocking keeps it *honest*: `'never'` costs nothing to declare, so nobody is
pressured to lie about it.

`never` and `on-change` have no clock (`CYCLE_DAYS: null`) and are never reported overdue. A record
inherits the most demanding cycle among its answers — one `monthly` fact pulls the whole sheet forward,
because a sheet is what a person actually re-reviews.

The same logic governs `InsightQuestion.required`: a missing required answer is reported, not blocked.
Blocking would pressure staff to invent an answer rather than leave a blank — the exact failure the
editorial layer exists to prevent.

## Consequences
- **Positive:** The audit signal stays trustworthy, because declaring a cycle honestly is free.
- **Positive:** No content disappears from the live site as a side effect of a calendar.
- **Cost:** Stale content *can* remain published indefinitely if nobody reads the report. This is
  accepted: the failure is then an operational one with a visible signal, not a silent one. The
  mitigation is process (run the verifier during review), not code.
- **Rejected alternative — auto-hide overdue records:** rejected for the incentive collapse above.
- **Rejected alternative — fail the build on overdue:** same problem, plus it couples deployment of an
  unrelated code change to the property's review calendar.

**If someone later proposes making freshness blocking, this ADR is the answer.** The question to ask
first is: what stops everything from being marked `never`?

Relates to: [ADR‑008](ADR-008-truth-gates-fail-closed.md) (the opposite decision, for the other class).
