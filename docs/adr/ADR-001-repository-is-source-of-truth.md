# ADR‑001 — Repository is the Source of Truth

**Status:** Accepted · 2026‑07

## Context
This project has a rich planning corpus: the Implementation Report, prior design conversations, and the Technical Baseline. Planning documents drift from reality — the Report describes Tailwind and Preact as "already in use," but the repository has neither. When an AI or a developer trusts a document over the code, it hallucinates dependencies, assumes structure that doesn't exist, and writes changes that don't apply cleanly.

## Decision
The **repository is authoritative.** When any planning document and the repository disagree, the repository wins. Every session begins by inspecting actual files (`package.json`, config, source) rather than reasoning from documents or memory. No dependency is assumed to exist without verifying it is installed.

## Consequences
- **Positive:** Eliminates the most common source of off‑the‑rails AI code. Changes are grounded in what actually exists.
- **Positive:** Planning documents become *aspirational maps*, not commands — they inform sequence, not implementation details.
- **Cost:** Every session pays a small up‑front audit cost. The Technical Baseline §1 exists to make that cheap by recording the audited state.
- **Obligation:** When reality changes, update the Baseline in the same PR — otherwise it becomes just another drifting document.
