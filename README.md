# Best Western Vernal Inn — Astro 6 Site

The Best Western Vernal Inn website, rebuilt on **Astro 6** as an SEO-infrastructure
upgrade of the original flat-HTML site. Same URLs, same metadata, same schema, same
content — now driven by one layout, shared components, and a single business-data file.

See **`MIGRATION_REPORT.md`** for the full conversion record, decisions, preserved URLs,
schema inventory, and the missing-image list.

## Requirements

- **Node 22.12+** (Astro 6 requirement; pinned in `.nvmrc`)

## Setup

```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm run preview    # preview the built site
```

## Before launch

Restore the 26 image assets (logo.webp, 35.webp, …) into **`public/images/`**.
The full list is in `MIGRATION_REPORT.md` §8. Image references and layout containers
are already in place; only the binary files are missing.

## Project structure

```
src/
  layouts/BaseLayout.astro    page shell: head, OG/Twitter, canonical, schema slot, nav/footer
  components/                 Header, Footer, CTA, FAQ, Breadcrumbs, SummaryBlock, RelatedLinks
  pages/                      one .astro per page → /page.html URLs
  data/business.ts            NAP / phone / geo / hours / booking URL (single source of truth)
  styles/global.css           the legacy stylesheet, imported once by the layout
public/                       robots.txt, sitemap.xml, _redirects, images/
content.config.ts             Astro 6 collections (scaffolded for future content)
astro.config.mjs              site URL + build.format:'file' (keeps .html URLs)
```

## URL preservation

`astro.config.mjs` sets `build.format: 'file'` and `trailingSlash: 'ignore'` so pages
emit as `/page.html` exactly like the legacy site. Do not change these without planning
redirects.

## Redirects

Host-level via `public/_redirects` (Cloudflare/Netlify), carried over from the legacy
site — all 301. See the migration report for why these are not duplicated in
`astro.config.mjs`.

## Deploy (Cloudflare Pages)

- Build command: `astro build`
- Output directory: `dist`
- Connect the GitHub repo; verify the branch preview before merging to `main`.
