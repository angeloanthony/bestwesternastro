# ADR‑013 — Operational Knowledge Is Acquired, Never Authored

**Status:** Accepted · 2026‑07 · (governs `src/data/frontDeskInsights.ts` and `docs/BUSINESS_KNOWLEDGE_WORKBOOK.md`)

## Context
ADR‑008 says what may publish. ADR‑010 says what is recorded about a fact. ADR‑011 says where facts
live. None of them says where a fact may **come from** — and that turned out to be the load-bearing
question.

The 2026‑07‑31 owner interview made it concrete. The material that has value on the site is not
research: it is the entrance guests drive to by mistake, the wing night-shift crews get placed in, the
point on the road where the map stops loading. None of it is discoverable. All of it is one
conversation away from being lost.

Two failure modes were live during that same session and neither is covered by an existing ADR:

1. **A plausible sentence was nearly recorded as knowledge.** "Bring water, fill your gas tank before
   Flaming Gorge" is true, sensible, and appeared in a draft written *for* the project. The owner never
   said it. It reads exactly like the answers that came from him.
2. **A general remark was nearly attributed to a specific place.** The owner said cell coverage drops in
   "many recreation areas." Filing that under Ashley National Forest — the page whose entire defect is
   copy that could describe any national forest — would have deepened the failure the sheet exists to
   fix.

Both are cases where the *form* of a statement is indistinguishable from acquired knowledge while its
*origin* is not.

## Decision
**Operational knowledge enters the system only by being obtained from a person who holds it. It is never
written, inferred, generalised, or filled in — by a contributor, by an editor, or by a model.**

1. **No answer may be composed.** If the interview did not cover a question, the answer stays an empty
   string. An empty answer is a correct outcome and is reported by `validateInsights()`. A plausible one
   is the failure this file exists to prevent. This is the rule that made Flaming Gorge's
   `what_to_bring` empty.
2. **No answer may be relocated to a more specific subject than the one it was given about.** A remark
   about "recreation areas" is not an answer about Ashley. Where the generalisation is tempting and
   might be true, record it against the specific subject at `confidence: 'pending'` with a note naming
   the inference — never at a publishable confidence. Answering the question either way closes it;
   "no, coverage is fine" is as good an answer as confirmation.
3. **Comparative and competitive claims are `pending` on arrival.** "Every competitor site does X",
   "best in Vernal", "nobody else does this" describe parties who were not interviewed. Observation of a
   handful of competitor sites is an observation, not a fact about the market. Where the claim is not
   verifiable as stated, omit it rather than record it — `pending` means *a real answer awaiting
   verification*, and an unverifiable claim is not one.
4. **Contribution and authorisation are separate acts.** Housekeeping, maintenance, breakfast, and the
   front desk each see the property differently, and the best answers are frequently not the owner's.
   Any number of people may contribute to a sheet; their role is written beside the answer and lands in
   that answer's `basedOn`. **Exactly one person authorises the sheet** — `reviewedBy`, the owner or GM.
   You want the breakfast attendant's observation. You do not want the breakfast attendant deciding what
   the hotel publishes.
5. **Anecdotes are acquired knowledge too, and are used sparingly.** A specific remembered incident —
   a family who tried to fit three destinations into one afternoon — carries more trust than the
   generalisation drawn from it. It is subject to every rule above: never composed, never embellished,
   no guest identifiable. And it is rationed: a page with five anecdotes has none, because the reader
   stops noticing them.

## Consequences
- **Positive:** The site's differentiating content is, by construction, content a competitor cannot
  produce by reading the site. Anything that could have been written by someone who has never been to
  Vernal is excluded at the point of entry rather than caught in review.
- **Positive:** Gaps stay visible. Because nothing is filled in, the empty cells are an accurate map of
  what has not been asked — which is how the Ashley gap was found at all.
- **Cost:** Content velocity is bounded by people's availability, permanently. There is no way to
  accelerate it with more engineering, and attempts to do so will look like an improvement.
- **Cost:** Rule 1 is unenforceable by code. A machine cannot tell a fabricated answer from a real one —
  every gate in `frontDeskInsights.ts` checks *whether* an answer is signed, never whether it is true.
  This ADR is the only control on origin, which is precisely why it is written down.
- **Rejected — "draft it and have the owner correct it":** faster, and it inverts the burden. A person
  handed a plausible draft edits its wording; a person handed a blank question answers it. The second
  produces knowledge, the first produces agreement with whatever was drafted.

Relates to: [ADR‑008](ADR-008-truth-gates-fail-closed.md) (what may publish),
[ADR‑010](ADR-010-confidence-and-visibility-are-independent.md) (what is recorded about it),
[ADR‑011](ADR-011-editorial-data-separate-from-rendering.md) (where it lives). This ADR governs
**origin**, which those three deliberately do not.
