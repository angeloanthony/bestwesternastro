# ADR‑002 — Preserve Flat‑HTML URLs (`build.format:'file'`)

**Status:** Accepted · 2026‑07

## Context
The legacy Best Western Vernal Inn site served pages at flat `/page.html` addresses. It was migrated to Astro 6 verbatim, with 23 pages ranking on their existing URLs and ~18 host‑level 301 redirects consolidating old duplicates. Astro's default output is `build.format:'directory'`, which emits `/page/index.html` and would **change every URL** on the site — silently discarding accrued SEO authority and breaking inbound links.

## Decision
Keep `build.format:'file'` and `trailingSlash:'ignore'` in `astro.config.mjs`. Existing URLs are immutable. New app routes (Adventure Pass, map, dynamic `places/[slug]`) live under new path prefixes and must not disturb the flat‑HTML pages. Redirects stay at the host level in `public/_redirects` — **not** mirrored in Astro's `redirects` config, because with `format:'file'` an Astro redirect for `x.html` would emit a corrupt `x.html.html` file.

## Consequences
- **Positive:** Zero URL churn; months of SEO ranking preserved.
- **Positive:** A clear, testable constraint — "all 23 URLs resolve identically" is a merge gate (see the Regression Checklist).
- **Cost:** New dynamic routes must be validated against the flat‑file emitter to avoid filename collisions.
- **Reversal:** Would require a full 301 map from every old URL to its new form, plus re‑indexing time. Effectively one‑way; do not change without that plan.
