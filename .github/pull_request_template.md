## What & why

<!-- One or two sentences. Link the Baseline section / ADR this serves. -->

## Files changed (list before you edited — per Technical Baseline §0.5)

<!-- Each file + one line on why it needed to change, and the regression risk. -->

## Regression Checklist (Technical Baseline §8)

> Most of these break with **no build error**. Check each or mark N/A with a reason.

- [ ] Existing URLs unchanged (all 23 pages + `_redirects` targets resolve identically)
- [ ] Existing page metadata unchanged (title, description, robots)
- [ ] Canonical URLs unchanged
- [ ] Structured data (JSON-LD) unchanged on existing pages
- [ ] `public/sitemap.xml` unchanged (or intentionally updated + reviewed)
- [ ] `public/robots.txt` unchanged
- [ ] Existing CSS unchanged — no `global.css` override, no Tailwind preflight bleed
- [ ] `.rv`/`.on` reveal-on-scroll still fires (no "missing sections")
- [ ] `business.ts` not moved; only additively extended
- [ ] Core Web Vitals unaffected (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- [ ] Lighthouse comparison completed vs. `main` (attach before/after)
- [ ] Mobile comparison completed

## Notes

<!-- Business gates (GM sign-off on book-direct claims), follow-ups, deferred items. -->
