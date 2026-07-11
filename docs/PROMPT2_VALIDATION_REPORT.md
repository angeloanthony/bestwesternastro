# Prompt 2 — Foundation Scaffold: Validation Report

**Branch:** `feature/foundation-scaffold` · **Type:** infrastructure-only, zero-regression
**Result:** ✅ All 23 production pages render byte-identically. Foundation added. No existing page edited.

---

## 1. What this PR does

Establishes the AdventureOS development foundation on top of the existing production Astro site — **without** touching any production page's HTML, CSS, URLs, or SEO. No Adventure Pass, Supabase, Workers, backend, or new pages (see §7).

## 2. Migration summary

| Added | How it stays safe |
|---|---|
| **Tailwind v4** (`@tailwindcss/vite`) | Wired as a Vite plugin; entrypoint `src/styles/tailwind.css` imports **theme + utilities layers only — Preflight omitted** (ADR-004). Imported by nothing yet, so it compiles into zero production pages. |
| **Preact** (`@astrojs/preact` + `preact`) | Renderer registered; `src/islands/` created with a non-production `HelloIsland.tsx` smoke test. No page uses a `client:*` directive, so no page ships JS. |
| **Scaffold dirs** | `src/{islands,lib,types,utils,services}`, `database/{migrations,seed}`, `workers/`, `tests/` — empty, each with a purpose-stub README. Nothing populated. |
| **Tooling** | ESLint (flat config), Prettier, EditorConfig, `.vscode/` recommendations — all **scoped to new code only**; existing site is prettier-ignored and eslint-ignored, so zero reformatting of migrated files. |
| **Environment** | `.env.example` with placeholders only. No secrets. Nothing consumes it yet. |
| **CI** | `.github/workflows/ci.yml`: install → `prettier --check` → `eslint` → `astro build`. Fails on any error. No deploy automation. |
| **Visual regression** | Playwright harness (`tests/visual/`) screenshotting 5 representative pages × 2 viewports; committed baselines. |

## 3. Zero-regression proof (before vs. after)

A reference build of `main`'s `dist/` was captured **before** any change, then diffed byte-for-byte against the scaffold build.

```
Reference dist: 91 files   Scaffold dist: 94 files
Recursive diff: ONLY these 3 files are new; every other file is byte-identical:
  dist/_astro/client.CcVZ8Wem.js
  dist/_astro/client.DgVWsbT7.js
  dist/_astro/signals.module.DVysQVB9.js
```

Verified explicitly:
- ✅ **Existing URLs unchanged** — all 23 `.html` files present at identical paths; `build.format:'file'` untouched.
- ✅ **HTML/metadata/canonical/structured-data unchanged** — all 91 original files byte-identical (title, description, canonical, OG, JSON-LD all inside them).
- ✅ **CSS unchanged** — the only `_astro` reference in any page is the pre-existing `BaseLayout.*.css`, byte-identical.
- ✅ **No page gained a `<script type="module">`** — grep confirms zero module scripts across all built pages.
- ✅ **`sitemap.xml`, `robots.txt`, `_redirects` unchanged** — untouched in `public/`.
- ✅ **`.rv`/`.on` reveal system unchanged** — `BaseLayout` not edited.
- ✅ **`business.ts` untouched.**
- ✅ **No Tailwind classes in any production page.**

## 4. The one unavoidable difference (documented per Prompt 2)

The 3 new files in `dist/_astro/` are the **Preact renderer's client runtime** (`client.*.js` + `signals.module.*.js`). Verified facts:
- **Referenced by zero HTML pages** (grep by exact filename → no matches). No production page loads them.
- They emit **even with no island present** — proven by removing `HelloIsland.tsx` and rebuilding: the chunks still appear. They are pure `@astrojs/preact` integration overhead, not caused by our island.
- **Impact on existing pages: none** — no page requests them; they are dead weight in the CDN bundle only, and become live the moment the first real island hydrates.

This is inherent to registering the Preact renderer (which Prompt 2 requires) and cannot be removed without removing Preact. Accepted and documented.

## 5. Gate results

| Gate | Result |
|---|---|
| `astro build` | ✅ 23 pages, clean |
| `prettier --check .` | ✅ PASS (Markdown/legacy site ignored; all new code conforms) |
| `eslint .` | ✅ PASS (new code only) |
| `astro check` | ✅ 0 errors (2 pre-existing `pageScripts` warnings on legacy pages, not introduced here) |
| `npm run test:visual` | ✅ 10/10, stable across repeated runs |

## 6. Visual regression — what it covers and a real catch

**Coverage:** `home`, `things-to-do-vernal-utah`, `extended-stay-hotel-vernal-utah`, `workforce-housing-vernal-utah`, `404` — each at desktop (1280) and mobile (Pixel 5). Baselines committed under `tests/visual/__snapshots__/`.

**Determinism engineering** (the homepage is media-heavy): web-font readiness wait; JS `setInterval` slideshow neutralized; CSS transitions/animations/`transform` frozen; autoplay video paused; cross-origin YouTube `<iframe>`s and `<video>` hidden via `visibility:hidden` (keeps layout box, removes async pixels); lazy images forced eager + decoded before capture; `retries: 2` to absorb rare 1-frame flakes (a real regression fails every attempt).

**A regression the harness caught in the act:** the sibling `adventureastro` project runs its own Astro preview on the default port **4321**. Playwright's `reuseExistingServer` silently connected to it, so the first baselines captured the **wrong site** (an ATV-tours page). Fixed by pinning this project to a **dedicated port 4331** with `reuseExistingServer:false`, and adding an in-test guard that asserts every page contains "Best Western" — so a wrong-site capture now fails loudly instead of passing silently.

> ⚠️ **CI note:** visual regression is intentionally **not** gated in CI. Playwright pixel snapshots are OS-specific (baselines here are `*-win32.png`); running them on an ubuntu runner would mismatch. Gating them needs a pinned container (follow-up). Locally they are the reliable regression guard.

## 7. Explicitly out of scope (confirmed absent)

Adventure Pass · Crew Mode · Live Map · Supabase · Auth · AI Concierge · database content · corporate forms · booking widgets · new pages · existing-page redesigns. None implemented. Scaffold directories exist but are empty.

## 8. Files in this PR

**Modified (3):** `astro.config.mjs` (added Preact integration + Tailwind Vite plugin — additive block, all existing config/comments preserved), `package.json` (deps + scripts), `.gitignore` (test artifacts). **Regenerated:** `package-lock.json`.

**New — config/tooling:** `src/styles/tailwind.css`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.vscode/{extensions,settings}.json`, `.env.example`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `playwright.config.ts`.
**New — scaffold:** `src/islands/{HelloIsland.tsx,README.md}`, `src/{lib,types,utils,services}/README.md`, `database/{migrations,seed}/README.md`, `workers/README.md`, `tests/README.md`.
**New — tests:** `tests/visual/existing-pages.spec.ts` + committed `tests/visual/__snapshots__/` baselines (10 PNGs).
**New — docs:** `docs/TECHNICAL_BASELINE.md`, `docs/adr/*` (this validation report included).

**No file under `src/pages/`, `src/components/`, `src/layouts/`, `src/data/`, or `src/styles/global.css` was modified.**

## 9. Reviewer quick-verify

```bash
npm ci
npm run build          # 23 pages, clean
npx prettier --check . # PASS
npx eslint .           # PASS
npm run test:visual    # 10/10 (needs: npx playwright install chromium)
```
