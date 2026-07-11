# src/islands/

Interactive Preact components ("islands"), hydrated opt-in per page with a
`client:load | client:visible | client:idle | client:only` directive. Static
pages stay static; only the island's own JS ships, only where used.

**Conventions**
- One component per file, default export, `.tsx`.
- Import Tailwind via `../styles/tailwind.css` inside the island when needed — never from `BaseLayout`.
- The map island (`LiveMap`) is always `client:visible` (largest bundle — Baseline §2 / Report §8).

`HelloIsland.tsx` is a temporary runtime smoke test — delete when the first real island ships.
