# AdventureOS v1 — Technical Baseline

**Status:** v1.0 · Authoritative reference for all future work
**Repo:** `best-western-vernal-inn` (Astro 6) · branch `main`
**Scope decision:** Option B (90‑Day Build) per the Implementation Report, introduced *incrementally on top of the existing production site* — not as a rewrite.

> This document is the contract for every subsequent engineering session. When the Implementation Report and this repository disagree, **this document (and the repository it describes) wins.** The Report is the destination; this Baseline is the starting coordinate. Update this file whenever a constraint or dependency actually changes — never let a coding session silently invalidate it.

---

## 0. Engineering Contract (read at the start of every session)

You are joining an **existing production Astro project**. This is not greenfield.

1. **The repository is authoritative.** If it differs from any planning document (the Implementation Report, prior chats, this file's older revisions), the repository wins. Verify against files, not memory.
2. **Never assume a dependency exists.** Check `package.json` before importing anything. Today the only runtime dependency is `astro`.
3. **Never replace existing architecture without explicit written justification** in this file, reviewed and approved first.
4. **Preserve all production URLs and SEO behavior.** See §2 — these protect months of SEO work and are non‑negotiable.
5. **Before making changes, in every session:**
   1. Inspect the repository.
   2. List every file you intend to modify or create.
   3. Explain why each change is necessary.
   4. Identify potential regressions (URLs, SEO, structured data, the `.rv` reveal system, `global.css` cascade).
   5. **Wait for approval before editing.**

No application code is produced from this Baseline. It produces understanding, a plan, and a set of guardrails.

---

## 1. Current Repository Audit (what actually exists, verified)

**Stack as built:**

| Layer | Reality on disk | Notes |
|---|---|---|
| Framework | **Astro 6** (`^6.0.0`) | Static build |
| Language | **TypeScript**, `astro/tsconfigs/strict` | `tsconfig.json` extends strict |
| Styling | **`src/styles/global.css`** (legacy stylesheet, imported once by `BaseLayout`) | **No Tailwind** |
| Interactivity | Inline `<script>` in `BaseLayout` + per‑page `<slot name="scripts">` | **No Preact / no islands / no UI framework** |
| Fonts | Playfair Display + Lato via Google Fonts `<link>` | Matches the Report's design system |
| Node | **22.12+** (`.nvmrc`, `engines`) | Astro 6 requirement |
| Hosting | Cloudflare Pages (build `astro build`, output `dist/`) | Per README |

**Dependencies (entire set):**
- `dependencies`: `astro`
- `devDependencies`: `@astrojs/check`, `typescript`
- **Not present:** Tailwind, Preact, `@supabase/*`, any Cloudflare Workers tooling (`wrangler`), any AI SDK, any map library, ESLint, Prettier, test runner, PWA plugin.

**Content & routing:**
- **23 pages** in `src/pages/` — one `.astro` per page, hand‑distinct SEO pages (e.g. `hotel-near-flaming-gorge.astro`, `extended-stay-hotel-vernal-utah.astro`, `index.astro`, `404.astro`).
- `astro.config.mjs`: `build.format:'file'` + `trailingSlash:'ignore'` → emits `dist/page.html`, preserving exact legacy addresses.
- `public/_redirects`: **~18 host‑level 301s** consolidating legacy duplicate URLs (`/petfriendly.html` → `/pet-friendly-hotel-vernal-utah`, etc.). Canonical targets are **extensionless**; `.html` files are served for them by the host.

**Shared architecture:**
- `src/layouts/BaseLayout.astro` — the single shell. Owns `<head>` (title, description, canonical, OG, Twitter), plus named slots: `analytics`, `schema`, `head`, `scripts`. Owns the nav/burger/scroll‑top chrome and the **`.rv` → `.on` `IntersectionObserver`** reveal‑on‑scroll system.
- `src/components/` — `Header`, `Footer`, `CTA`, `FAQ`, `Breadcrumbs`, `SummaryBlock`, `RelatedLinks` (7 `.astro` components).
- `src/data/business.ts` — single source of truth for NAP, phone (`+14357896625`), geo (`40.4474, -109.5194`), hours, `bookingUrl`, site/OG image, partners. Exported `const BUSINESS` + `Business` type.
- `content.config.ts` — Astro collections (`articles`, `local`) **scaffolded but inert** (no files under `src/content/` yet). Ready for the guide/company‑page content track.
- `public/` — `_redirects`, `robots.txt`, `sitemap.xml`, `images/` (**54 image files present** — the README's "26 missing images" note is stale/resolved).

**Known content note (unresolved, flagged in MIGRATION_REPORT §⚠):** the homepage `<title>`/OG still reads "Extended Stay Hotel…" (copied from the extended‑stay page during verbatim migration). One‑line fix in `src/pages/index.astro` when desired — out of scope until approved.

---

## 2. Immutable Constraints (the "Do Not Break" list)

These protect existing SEO and revenue. Changing any one requires explicit approval and a redirect/QA plan documented here first.

- **DO NOT** change `build.format:'file'` in `astro.config.mjs`. (Astro's default `'directory'` would rename every URL.)
- **DO NOT** change `trailingSlash:'ignore'`.
- **DO NOT** rename, move, merge, or delete any of the 23 existing SEO pages, or alter their URLs.
- **DO NOT** modify the content, `<title>`, meta description, canonical, or copy of existing SEO pages (except the approved homepage‑title fix).
- **DO NOT** remove or alter any per‑page JSON‑LD structured data (injected via `<slot name="schema">`).
- **DO NOT** touch the `public/_redirects` 301 rules without a migration plan.
- **DO NOT** move or restructure `src/data/business.ts`; it is imported everywhere. Extend by adding fields, never by relocating.
- **DO NOT** replace or globally reset `src/styles/global.css`. New styling must be **additive** and must not restyle existing pages.
- **DO NOT** break the `.rv`/`.on` `IntersectionObserver` in `BaseLayout` — elements with class `.rv` start hidden and fade in on scroll. Breaking it re‑creates the original "missing sections" bug.
- **DO NOT** add a client‑side router or convert the static pages to an SPA. Islands only, opt‑in per page.

---

## 3. Gap Analysis (Report assumes → repository lacks)

| The Report assumes… | Reality | Consequence / required action |
|---|---|---|
| "Tailwind v4 (already in use)" | Not installed; `global.css` styles everything | Must **add** Tailwind, and **scope it so its base reset (preflight) does not override `global.css`** and visually break all 23 SEO pages. See §5. |
| "Astro + Preact islands" | No Preact, no islands, no integration | Must add `@astrojs/preact` + `preact`; establish `src/islands/` and hydration conventions. |
| Supabase backend (Postgres/PostGIS/pgvector/Auth/Storage/RLS) | None | New project + `database/` migration workflow; nothing exists yet. |
| Cloudflare Workers (`/api/ask`, `/api/plan`, `/api/lead-notify`) | None; no `wrangler` | New `workers/` dir + Wrangler config + secrets. |
| MapLibre + OpenFreeMap | None | Add as a lazy island only (`client:visible`). |
| AI Concierge (Claude Haiku + RAG) | None | Depends on Supabase + pgvector + Worker; last in sequence. |
| PWA (manifest + service worker) | None | Additive; must not interfere with `build.format:'file'` output or cache stale HTML. |
| GA4 + CallRail | Not wired, but **`<slot name="analytics">` seam already exists** in `BaseLayout` head | Drop snippets into the existing slot — no layout surgery needed. |
| `places/[slug].astro` generated from Location table | Only hand‑authored pages exist | New dynamic route via `getStaticPaths()`; must coexist with flat‑HTML pages without disturbing them. |
| ESLint / Prettier / tests | None | Add tooling as part of foundation. |
| Repo dirs `database/ workers/ src/islands/ src/lib/ docs/` | Only `docs/` (this file) being created | Create as introduced, not all at once. |

---

## 4. Approved Technology Additions (Option B, locked)

Additions are approved **in principle**; each is introduced per the Migration Plan (§5), never speculatively.

- **Frontend:** Tailwind CSS v4 (scoped), Preact (`@astrojs/preact`) for islands, `@vite-pwa/astro` (or Vite PWA plugin) for the PWA layer.
- **Backend:** Supabase (Postgres 16 + PostGIS + pgvector + Auth + Storage + RLS). Managed migrations in `database/migrations/`.
- **Serverless:** Cloudflare Workers via Wrangler — `ask.ts`, `plan.ts`, `lead-notify.ts`.
- **Maps:** MapLibre GL + OpenFreeMap tiles (lazy island).
- **AI:** Claude Haiku (`claude-haiku-4-5`) behind the `/api/ask` Worker; embeddings for pgvector RAG. Strict grounding, citations, rate/cost caps.
- **Email:** Resend (magic links + Pass delivery + lead alerts).
- **Analytics:** GA4 + Cloudflare Web Analytics; CallRail for call tracking.
- **Tooling:** ESLint + Prettier + a test runner (Vitest) + a Supabase type‑gen step feeding `src/lib/schema.ts`.

Anything not on this list is **deferred** (see Report §16) and does not get built in v1: multi‑tenant/partner portal, loyalty ledger, QR passport, adaptive itinerary, native app.

---

## 5. Migration Plan (how each addition lands without breaking the site)

**Guiding rule:** every addition is *additive and reversible*. Existing pages must render byte‑identically until an existing page is deliberately, and separately, chosen for enhancement.

1. **Tailwind (scoped, preflight‑safe).** Install Tailwind v4 + `@tailwindcss/vite`. **Disable/neutralize preflight** or restrict Tailwind's reset so it cannot cascade onto legacy markup. Prove it by building and diffing the 23 pages — zero visual change is the acceptance test. Tailwind is used only in **new** islands/pages initially.
2. **Preact islands.** Add `@astrojs/preact`. Create `src/islands/`. New interactive components hydrate opt‑in (`client:load|visible|idle|only`) — the static pages stay static. Map island is always `client:visible`.
3. **`src/lib/`.** Add `supabase.ts` (client), `hours.ts` (client mirror of `is_open_now`), `schema.ts` (generated types). No behavior change to existing pages.
4. **Supabase.** Provision project; author `database/migrations/001_*.sql` = full schema + RLS + RPCs (`nearby`, `is_open_now`, `match_locations`) per Report §6–7. Seed importer (`database/seed/import.ts`) validates before insert.
5. **Workers.** Add `workers/` + `wrangler` config; secrets (Anthropic key, service role) never in the client bundle.
6. **Dynamic location pages.** `src/pages/places/[slug].astro` via `getStaticPaths()` reading published Locations. Confirm output filenames don't collide with flat‑HTML rules.
7. **PWA.** Manifest + service worker last; cache policy must not serve stale HTML for the SEO pages (network‑first for documents, precache only the app shell + Crew dataset + downloaded guides).
8. **Analytics/CallRail.** Inject via the existing `<slot name="analytics">` — no layout rewrite.

Each step: branch → list files → build → diff SEO pages → review → merge.

---

## 6. Sprint 1 — Two Parallel Tracks

Aligned with Report §13 (Sprint 1) and §18. Run concurrently — Track B is the revenue piece and depends on almost none of Track A.

### Track A — Infrastructure foundation
- Add Tailwind (scoped, preflight‑safe) + Preact integration; prove zero visual regression on the 23 pages.
- Add ESLint, Prettier, Vitest, `.env` specification, `src/lib/` skeleton.
- Provision Supabase Pro; run migration `001` (full schema + RLS + RPC functions).
- Stand up `workers/` + Wrangler config (empty handlers wired, secrets configured).
- CI: build + typecheck + lint on PR; Cloudflare Pages preview deployments.

### Track B — Conversion layer (revenue, ships Week 2)
Needs only the `lead` table from Track A; everything else is static/client‑only.
- **Sticky booking bar** island (mobile + desktop, one tap to `bookingUrl` / click‑to‑call from `business.ts`).
- **"Book Direct & Save"** trust block (no fees, best‑rate guarantee, free parking incl. truck/trailer, free breakfast, flexible cancellation) — *copy pending GM sign‑off; do not publish an unverified guarantee.*
- **Trust signals** (Best Western mark, review snippets, real photos from `public/images/`).
- **Click‑to‑call** with call tracking; **GA4 conversion events** via the existing `analytics` slot.
- **Corporate rate / room‑block form** → writes to `lead` table + emails front desk (`lead-notify` Worker).
- Publish **W‑9 / COI** downloads under `public/docs/`.

**Business gate (Report §18, before Track B copy goes live):** commission structure in writing; every book‑direct benefit confirmed by the GM. Engineering can build the components in parallel, but the *claims* don't publish until confirmed.

---

## 7. Definition of Done for this Baseline
- [x] Repository audited against actual files (not the Report's assumptions).
- [x] Immutable constraints enumerated.
- [x] Gaps between Report and repo identified.
- [x] Approved additions locked to Option B.
- [x] Additive, reversible migration path defined per addition.
- [x] Sprint 1 split into infra + revenue tracks with the business gate called out.

**Next action:** review this file. On approval, Prompt 2 scaffolds Track A step 1–2 (Tailwind scoped + Preact) *only*, with a zero‑regression diff of the 23 SEO pages as the acceptance test — before any Supabase or Worker work.

---

## 8. Regression Checklist (required on every PR)

No PR merges until every box is checked or explicitly N/A with a reason. This is mirrored in `.github/pull_request_template.md` so it appears automatically. It exists to make SEO/UX regressions impossible to merge silently — most of these produce **no build error** when they break.

```
Regression Checklist
□ Existing URLs unchanged (all 23 pages + _redirects targets resolve identically)
□ Existing page metadata unchanged (title, description, robots)
□ Canonical URLs unchanged
□ Structured data (JSON-LD) unchanged on existing pages
□ public/sitemap.xml unchanged (or intentionally updated + reviewed)
□ public/robots.txt unchanged
□ Existing CSS unchanged — no global.css override, no Tailwind preflight bleed
□ .rv/.on reveal-on-scroll still fires (no "missing sections")
□ business.ts not moved; only additively extended
□ Core Web Vitals unaffected (LCP < 2.5s, CLS < 0.1, INP < 200ms)
□ Lighthouse comparison completed vs. main (attach before/after)
□ Mobile comparison completed (this audience is overwhelmingly mobile)
□ Files-to-be-changed were listed and approved before editing (§0.5)
```

**Acceptance test for any Tailwind/CSS/layout PR:** build `main` and the branch, diff the rendered HTML/CSS of all 23 SEO pages — the expected diff is **empty** unless a page was deliberately chosen for enhancement in this PR.

## 9. Architecture Decision Records

Significant, hard‑to‑reverse decisions live as short records in [`docs/adr/`](adr/) so their rationale survives past the conversation that produced them. Current log:

- [ADR‑001 — Repository is the Source of Truth](adr/ADR-001-repository-is-source-of-truth.md)
- [ADR‑002 — Preserve Flat‑HTML URLs (`build.format:'file'`)](adr/ADR-002-preserve-flat-html-urls.md)
- [ADR‑003 — Adopt Supabase over a FastAPI Stack](adr/ADR-003-adopt-supabase.md)
- [ADR‑004 — Add Tailwind Without Preflight](adr/ADR-004-tailwind-without-preflight.md)
- [ADR‑005 — AI Concierge Scope Limited to Vernal](adr/ADR-005-ai-scope-limited-to-vernal.md)

Add a new ADR whenever a decision is costly to reverse or someone will ask "why did we do it this way?" six months from now. Never edit a superseded ADR — mark it `Superseded by ADR‑NNN` and write a new one.
