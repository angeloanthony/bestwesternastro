# Prompt 4 — Supabase Foundation + Corporate Lead Form: Validation Report

**Branch:** `feature/foundation-scaffold` (continues) · **Type:** backend foundation + first interactive island
**Result:** ✅ Full schema + RLS + RPCs authored; corporate lead form live end-to-end with graceful fallback; 23 existing pages untouched.

---

## 1. The honest boundary

**I cannot provision a live Supabase project or run migrations — that needs your account.** So Prompt 4 delivers review-ready, **build-verified** artifacts plus a provisioning runbook ([docs/PROVISIONING.md](PROVISIONING.md)). What that means per layer:

| Layer | State |
|---|---|
| SQL migrations + seed | **Authored, not executed** (no live Postgres in this env). Validated on your `supabase db push`. |
| Supabase client, lead service, types | **Build + typecheck verified.** |
| Corporate form + page | **Built, rendered, visual-tested.** Works today via **mailto fallback**; switches to DB insert once env is set. |
| lead-notify Worker | **Authored + typechecked.** Deployed + webhook-wired per the runbook. |

## 2. What shipped

**Database (`database/`)** — faithful to Report §6–7:
- `migrations/001_schema.sql` — extensions (postgis, vector, uuid-ossp), `destination`, `location` (full, incl. governance columns + gps/gin/hnsw/fts indexes), `location_edge`, `member_profile`, `itinerary`, `partner`, `offer`, `event`, `lead`; `updated_at` triggers.
- `migrations/002_rls.sql` — RLS on day one: public reads published locations/events/active offers; members own their profile + itineraries; **anyone may INSERT a lead, nobody may SELECT** (staff via service role).
- `migrations/003_functions.sql` — `nearby`, `match_locations`, `rebuild_near_edges`, and a **real `is_open_now`** implementation (the Report left the body as `...`): handles seasonal overrides, explicit closures, split shifts, overnight intervals, and timezone conversion; returns `true`/`false`/`null` (unknown).
- `seed/001_destination.sql` — the Vernal destination (coords from `business.ts`).

**Site (`src/`):**
- `lib/supabase.ts` — anon browser client; **null + `isSupabaseConfigured=false`** when env unset, so callers degrade instead of crashing.
- `lib/leads.ts` — `submitLead()`: Supabase `lead` insert when configured, else a **pre-filled mailto** so no lead is lost.
- `lib/database.types.ts` — hand-authored `lead` types (replaceable by `supabase gen types`). *Note: written as `type` aliases, not `interface` — the SDK constrains tables to `Record<string, unknown>`, which interfaces don't satisfy (they'd make `.insert()` resolve to `never`).*
- `islands/CorporateRateForm.tsx` — **first real interactive island** (Preact, `client:visible`): client validation, submit states, a11y (labels, `aria-invalid`, `aria-live`), `data-track` hook. Styled with **Tailwind (preflight-off)** — the first real exercise of the Prompt 2 Tailwind setup.
- `pages/corporate-rates.astro` — new page hosting the form; `noindex` for now (utility page until the Module 7 corporate hub).

**Worker (`workers/`):** `lead-notify.ts` (Supabase-webhook-triggered → Resend email, shared-secret verified) + `wrangler.toml`.

## 3. Verification

| Check | Result |
|---|---|
| `astro build` | ✅ 24 pages (new: corporate-rates) |
| `astro check` | ✅ 0 errors |
| `eslint .` | ✅ PASS (incl. `workers/`) |
| `prettier --check .` | ✅ PASS |
| Visual regression | ✅ 12/12 (5 existing + corporate-rates × 2 viewports) |
| Form renders + Tailwind styling | ✅ confirmed by screenshot; borders/spacing intact → preflight-off working |

**Existing pages untouched:** BaseLayout / global.css / conversion.css / all 23 pages unchanged this PR — confirmed by the existing-page visual suite passing against the **Prompt 3 baselines** before the new page was added. Hydration is scoped: **only `corporate-rates.html` ships island JS**; the 23 existing pages remain framework-JS-free (`grep -l astro-island` → only corporate-rates).

## 4. Activation path (dormant until provisioned)

Set `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` → lead capture switches from mailto to DB insert. Deploy the Worker + wire the Supabase webhook → front-desk email alerts. Full steps in [docs/PROVISIONING.md](PROVISIONING.md). Until then the form still works (mailto).

## 5. Deferred / follow-ups

- Regenerate `database.types.ts` from the live project (`supabase gen types`).
- Run `select rebuild_near_edges();` after seeding real Location records.
- Full "Book Direct & Save" comparison block; W-9/COI downloads; the indexed corporate hub (Module 7) linking to `/corporate-rates`.
- Auth (magic link) + member accounts — Prompt 5.

## 6. Reviewer quick-verify

```bash
npm ci && npm run build && npx astro check     # 24 pages, 0 errors
grep -l astro-island dist/*.html               # only corporate-rates.html
npm run test:visual                            # 12/12
# SQL executes on `supabase db push` per docs/PROVISIONING.md
```
