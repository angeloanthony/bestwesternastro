# ADR‑004 — Add Tailwind Without Preflight

**Status:** Accepted · 2026‑07

## Context
The Implementation Report calls for Tailwind CSS v4, but the live site is styled entirely by the legacy `src/styles/global.css`, imported once by `BaseLayout`. Tailwind ships **Preflight**, an opinionated base reset that unstyles headings, lists, forms, buttons, and normalizes margins/typography. Loaded globally, Preflight would cascade over `global.css` and subtly restyle all 23 production SEO pages — with **no build error**. This is exactly the kind of change that silently degrades a mature site.

## Decision
Adopt Tailwind v4, but **neutralize Preflight** (disable it, or scope Tailwind's reset so it cannot apply to legacy markup). Tailwind is used only in **new** islands and pages; existing pages keep `global.css` untouched. The acceptance test for the Tailwind PR is a **byte‑level empty diff** of the rendered HTML/CSS across all 23 SEO pages.

## Consequences
- **Positive:** Modern utility styling for new UI without touching the working site.
- **Positive:** A concrete, automatable merge gate (zero visual regression) rather than a vibe check.
- **Cost:** New components can't rely on Preflight's normalization; base element styles must be set deliberately where needed.
- **Future:** If existing pages are ever migrated to Tailwind, do it page‑by‑page, each behind its own regression diff — never via a global reset.
