// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

// ─────────────────────────────────────────────────────────────
// Best Western Vernal Inn — Astro 6 configuration
//
// URL PRESERVATION (critical): the legacy site is served at
// /page.html (confirmed by the live _redirects file and the
// meta-refresh stub pages). Astro 6 would default to /page/
// (folder + trailing slash), which would CHANGE every URL.
//
//   build.format: 'file'  →  emits dist/page.html (NOT page/index.html)
//   trailingSlash: 'ignore' → never appends or strips a slash
//
// Result: every legacy URL keeps its exact address. No new
// redirects are forced by the migration itself.
// ─────────────────────────────────────────────────────────────
export default defineConfig({
  site: 'https://bestwesternvernalinn.com',
  trailingSlash: 'ignore',
  build: {
    // Keep flat .html URLs identical to the legacy static site.
    format: 'file',
  },
  // ───────────────────────────────────────────────────────────
  // ADVENTUREOS FOUNDATION (additive — see docs/TECHNICAL_BASELINE.md)
  //
  // Preact powers interactive islands (src/islands/). Adding the
  // renderer alone emits ZERO client JS: static pages stay static
  // until a component is used with a client:* directive. No existing
  // page uses one, so existing output is unaffected.
  //
  // Tailwind is wired as a Vite plugin but is only compiled where the
  // Tailwind entrypoint (src/styles/tailwind.css) is imported — and it
  // is imported ONLY by new AdventureOS islands, never by BaseLayout.
  // Preflight is disabled in that entrypoint (ADR-004) so Tailwind can
  // never restyle the legacy global.css cascade.
  // ───────────────────────────────────────────────────────────
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
  // ───────────────────────────────────────────────────────────
  // REDIRECTS — handled at the HOST level via public/_redirects
  // (Cloudflare Pages / Netlify), carried over verbatim from the
  // legacy site. We deliberately do NOT mirror them in Astro's
  // `redirects` config: with build.format:'file', an Astro redirect
  // for "/petfriendly.html" would emit a file named
  // "petfriendly.html.html", corrupting the URL. The host-level
  // _redirects file is the documented, correct mechanism (runbook
  // Part 8) and the legacy meta-refresh stub pages remain as a
  // second safety layer. All consolidation rules are therefore
  // preserved without any config-level entries here.
  // ───────────────────────────────────────────────────────────
});
