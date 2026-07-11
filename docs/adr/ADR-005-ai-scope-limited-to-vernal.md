# ADR‑005 — AI Concierge Scope Limited to Vernal

**Status:** Accepted · 2026‑07

## Context
The AI Concierge is the most differentiating feature and the one most able to embarrass the hotel. A concierge that confidently sends a family to a restaurant that closed two years ago, or gives wrong hunting/fishing regulations, does more damage than having no concierge at all. General‑purpose LLM behavior (open‑domain answering, invented details) is a liability in a hotel's voice.

## Decision
The Concierge is **hard‑scoped to Vernal and the Uintah Basin**, answering only from the verified `location` and `event` tables (plus a small hand‑curated hotel‑policy FAQ). It:
- retrieves via pgvector + Postgres FTS (hybrid), then answers with **Claude Haiku** under a strict grounding prompt;
- **cites** the specific records it used;
- **refuses** out‑of‑scope questions rather than guessing; never invents hours, prices, or phone numbers;
- links to Utah DWR for hunting/fishing regulations instead of advising; gives no medical/legal/safety‑critical advice;
- adds a freshness caveat when a cited record's `last_verified` is > 6 months old;
- is rate‑limited and cost‑capped (hard $50/mo → degrade to FAQ search), and logs every Q&A.

## Consequences
- **Positive:** Bounded, grounded, auditable answers — low hallucination risk, protects hotel reputation.
- **Positive:** The question log becomes a free, targeted content roadmap (which records to add next).
- **Positive:** Haiku + tight scope keeps cost at ~$3–8/month in normal use.
- **Cost:** The Concierge is only as good as the knowledge base; it will refuse a lot early on. That is the intended, safe failure mode.
- **Deferred:** Open‑domain answering, booking actions, and "ask a local" human Q&A are explicitly out of scope for v1.
