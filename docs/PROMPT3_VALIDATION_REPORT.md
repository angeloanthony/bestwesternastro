# Prompt 3 — Conversion Layer: Validation Report

**Branch:** `feature/foundation-scaffold` (continues) · **Type:** revenue layer (Baseline §6 Track B)
**Result:** ✅ Global book-direct bar + analytics wiring shipped on all 23 pages. All SEO invariants (URLs, titles, canonicals, structured data) byte-identical. Pages remain framework-JS-free.

---

## 1. Scope (as decided)

Per your three decisions this PR is deliberately narrowed to the revenue-critical, backend-free pieces:

| Decision | Chosen | Effect |
|---|---|---|
| Page scope | **Bar + analytics only** | Global sticky book-direct bar + analytics wiring. The full "Book Direct & Save" comparison block is deferred. |
| Corporate lead form | **Defer to Prompt 4** | Not built here — it needs the Supabase `lead` table + `lead-notify` Worker, which land in Prompt 4. |
| Book-direct claims | **Config-flagged, safe claims only** | Only GM-safe claims published; guarantee/cancellation gated OFF until sign-off. |

## 2. What shipped

- **`src/components/StickyBookingBar.astro`** — persistent bottom bar. **Static Astro, not a Preact island** (design upgrade): it's two links (Call + Book), needs no framework, works without JS, and keeps every page free of module JS. Renders a compact trust line from **confirmed claims only**; Call/Book carry `data-track` hooks. Matches the navy/gold brand via existing tokens.
- **`src/components/Analytics.astro`** — GA4 + CallRail loaders + a ~200-byte delegated `[data-track]` click listener. **Dormant by design:** with the env IDs unset (default), zero analytics `<script>` is emitted; the listener no-ops until `gtag` exists. Activates when `PUBLIC_GA4_MEASUREMENT_ID` / `PUBLIC_CALLRAIL_ID` are provisioned.
- **`src/styles/conversion.css`** — additive bar styling; references existing tokens; reserves `--sbb-h` body padding so the footer never sits under the bar; nudges the legacy `#stop` scroll-top button clear (via a scoped `!important`, `global.css` untouched); hidden in print; full-width tap targets on phones.
- **`src/data/business.ts`** — additively added the `bookDirect` claims array with per-claim `confirmed` flags (extend-in-place, not moved — §2).
- **`src/layouts/BaseLayout.astro`** — three additive edits: import `conversion.css`, render `<Analytics/>` in `<head>`, render `<StickyBookingBar/>` before `</body>`. This is the single change that puts the layer on all 23 pages.

**Business gate honored:** `no-fees`, `free-parking`, `free-breakfast` are published (`confirmed:true`); **`best-rate` and `flex-cancel` are `confirmed:false`** and do not render. Verified in the build: "No booking fees" present, "Best rate guarantee" absent. Flip a flag after GM sign-off — no code change.

## 3. This is an intentional-change PR

Unlike Prompt 2, the conversion layer **must** appear on existing pages, so "zero regression" is replaced by "intentional, reviewed change." What that means concretely, verified against the pre-change reference:

- ✅ **URLs unchanged** — all 23 `.html` files at identical paths; `build.format:'file'` / `trailingSlash` untouched.
- ✅ **Structured data (JSON-LD) byte-identical** — diffed on index / things-to-do / workforce-housing: identical.
- ✅ **`<title>` and canonical byte-identical** on the same sample.
- ✅ **`global.css` untouched**, `.rv`/`.on` untouched, `business.ts` extended in place (not moved).
- ✅ **The only additions to existing-page HTML** are: the `<aside class="sbb">` bar, the dormant analytics + tracking script, and the CSS-bundle filename rehash (because `conversion.css` joined the bundle). Diff confirmed nothing else changed.
- ✅ **Pages still ship zero `<script type="module">`** — the bar is static, analytics dormant; the only always-on JS is the tiny inline tracking listener. No framework JS added.
- ✅ **Visual baselines regenerated** intentionally to include the bar; suite is 10/10 stable across repeated runs, now with a positive assertion that `.sbb` is present on every page.

## 4. Gate results

| Gate | Result |
|---|---|
| `astro build` | ✅ 23 pages |
| `prettier --check .` | ✅ PASS |
| `eslint .` | ✅ PASS |
| `astro check` | ✅ 0 errors |
| `npm run test:visual` | ✅ 10/10, stable; asserts brand + `.sbb` on every page |

## 5. Dormant until provisioned (not blockers, tracked)

- **GA4 + CallRail:** wired but emit nothing until `PUBLIC_GA4_MEASUREMENT_ID` / `PUBLIC_CALLRAIL_ID` are set (business/account step, Report §14). The Report calls call-tracking non-negotiable — provision before hard launch to make ROI visible.
- **GM sign-off:** flip `best-rate` / `flex-cancel` to `confirmed:true` in `business.ts` once confirmed in writing.

## 6. Deferred to later steps (unchanged plan)

Full "Book Direct & Save" comparison block · corporate rate / room-block form (Prompt 4, with the `lead` table + `lead-notify` Worker) · W-9/COI downloads · rate-transparency content.

## 7. Reviewer quick-verify

```bash
npm ci && npm run build
grep -c "sbb-book" dist/index.html          # 1 — bar present in static HTML
grep -c "Best rate guarantee" dist/index.html  # 0 — unconfirmed claim gated out
grep -l 'type="module"' dist/*.html          # (none) — pages framework-JS-free
npm run test:visual                          # 10/10 (needs: npx playwright install chromium)
```
