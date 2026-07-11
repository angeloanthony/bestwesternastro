# tests/

- `visual/` — Playwright visual-regression snapshots of representative production
  pages. Run against a built `preview` server; the committed baseline snapshots are
  the reference "zero regression" must hold against as Tailwind/Preact/AdventureOS
  components are introduced.

Commands (see `package.json`):
- `npm run test:visual` — compare current build to committed baselines.
- `npm run test:visual:update` — regenerate baselines (only when a change is intended and reviewed).
