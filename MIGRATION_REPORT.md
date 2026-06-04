# Best Western Vernal Inn — Astro 6 Migration Report (rebuilt from bw.zip)

**Source:** `bw.zip` (latest version — includes the recently updated `index.html`).
**Type:** SEO infrastructure migration — content preserved verbatim, not redesigned or edited.
**Stack:** Astro 6.4.x · Node 22.12+ · TypeScript · Cloudflare Pages.
**Domain:** `https://bestwesternvernalinn.com` (non-www canonical).

## Result

- **23 content pages** rebuilt as `.astro`, each emitting at its exact legacy `.html` URL (`build.format:'file'`).
- **9 redirect aliases** preserved as 301s in `public/_redirects`.
- Build is clean: 23 pages.
- **Automated validation against bw.zip: 0 issues** — titles, meta descriptions, canonicals, and all JSON-LD schema (block count + @type set) match the source exactly. Content-area internal links preserved. (`&`→`&amp;` attribute encoding is the only textual difference and renders identically.)
- Shared shell: one `BaseLayout` + 7 components (Header, Footer, CTA, FAQ, Breadcrumbs, SummaryBlock, RelatedLinks); `business.ts` single source of truth; `global.css` (the source `styles.css`, unchanged).

## URL preservation
`astro.config.mjs`: `build.format:'file'` + `trailingSlash:'ignore'` → `/page.html` exactly as the legacy site. No URL changed.

## Redirects
Host-level `public/_redirects` (Cloudflare/Netlify), all 301, carried over verbatim. The 9 meta-refresh stub pages from the source are replaced by these cleaner 301 rules.

## Missing assets (action before launch)
`public/images/` is empty (images were stripped from the upload). Restore these 26 files before deploy: 1,2,31a,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,53,54,59,61,logo,puppy (.webp). References and containers are already in place.

## ⚠️ One content observation (NOT changed — flagged for your decision)
In the source `index.html`, the homepage `<title>` reads **"Extended Stay Hotel in Vernal, UT | Best Western Vernal Inn — Weekly Rates from $84/night"** and its OG/Twitter titles say "Extended Stay Hotel." The homepage H1 ("Best Western Inn"), canonical (`/`), and meta description are all correct homepage values — only the title tags look copied from the extended-stay page. Because this was a verbatim migration, I preserved it as-is. If you'd like, I can set a proper homepage title (e.g. "Best Western Vernal Inn | Hotel in Vernal, Utah — Book Direct") — it's a one-line change in `src/pages/index.astro`.

## Deploy (Cloudflare Pages)
Build command `astro build`, output dir `dist`, Node 22.12+. Per your Vernal Medicare experience: if Cloudflare's auto-build pipeline misbehaves, build locally and deploy with `npx wrangler deploy --assets=./dist` (or `npx wrangler pages deploy dist` for a Pages project).
