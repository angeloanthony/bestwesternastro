# M2 — Identity Verification (Adventure Pass, application layer)

**Date:** 2026-07-11 · **Branch:** `feature/m2-identity` · **Type:** offline (code + browser) verification
**Scope:** passwordless magic-link identity for the Vernal Adventure Pass — sign-in, the `/pass`
dashboard, session-based guard, sign-out, and the optional post-login profile. Per
[ADR-006](adr/ADR-006-passwordless-identity.md) and [ROADMAP.md](ROADMAP.md) M2.

> **Environment limitation (why some rows read BLOCKED, not PASS).** Same constraint as M1: no `.env`,
> no live Supabase Auth, no real inbox. Magic-link login *inherently* requires clicking a link in a
> received email, so the round-trip cannot be exercised headlessly **even with credentials**. Every
> hop provable from code or a real browser was proven here (PASS); the live magic-link flow, session
> persistence, and rollback drill are **BLOCKED — needs live project + inbox**, with the runbook in §7.
> Nothing below is assumed green.

> **Guardrail honoured:** no public page requires login, and none was modified. `/pass` is a new,
> `noindex`, additive surface. The 23 SEO pages, `global.css`, `business.ts`, `_redirects`,
> `astro.config.mjs`, and the `.rv` reveal system are untouched (visual regression 12/12 still green).

---

## 1. Summary

| Area | Result |
|---|---|
| Magic-link sign-in form (validation, send, states) | ✅ PASS (offline, OTP endpoint mocked) |
| Analytics events (`pass_signup_*`, `pass_profile_*`, `pass_signout`) | ✅ PASS (offline) |
| Fails-open when Supabase unconfigured / Auth unreachable | ✅ PASS |
| Public pages unaffected (no gating, no redirect, visual 12/12) | ✅ PASS |
| Client-side session guard (member vs anon) | ✅ PASS for the anon path; member path ⏳ live (§7) |
| Live magic-link round-trip (link received → session) | ⏳ BLOCKED — needs live project + inbox (§7) |
| Session persistence / returning user / logout / expiry | ⏳ BLOCKED — needs live session (§7) |
| `member_profile` write (optional profile) | ⏳ BLOCKED — needs authenticated session (§7); code + types verified |
| Rollback / fail-open-under-outage drill | ⏳ BLOCKED — operator step (§7, STAGING_CHECKLIST §E) |

**Bottom line:** the identity *code* is correct and safe on every axis provable offline, and it cannot
harm the public site (fails open, additive, no page gates). The live auth round-trip and session
lifecycle remain to be executed by the operator against the provisioned project (§7) before M2 is
signed off.

---

## 2. Architecture (as built)

Client-side auth only — dictated by [TECHNICAL_BASELINE.md](TECHNICAL_BASELINE.md) §2 ("islands only,
no SPA, no SSR conversion"). The magic-link flow runs entirely in the browser over the existing anon
client; the session lives in `localStorage` and auto-refreshes (supabase-js defaults). **No SSR
adapter was added; `build.format:'file'` is unchanged; the SEO pages stay fully static.**

- [src/lib/auth.ts](../src/lib/auth.ts) — `sendMagicLink`, `getSession`, `getUser`, `onAuthChange`,
  `signOut`. Every function returns a typed result / null when Supabase is unconfigured (never throws).
- [src/lib/profile.ts](../src/lib/profile.ts) — `getProfile` / `saveProfile` for the member's own row
  (RLS `prof_own` scopes it; `destination_id` resolved from the seeded `vernal` row).
- [src/lib/database.types.ts](../src/lib/database.types.ts) — extended with `member_profile` and
  `destination` (additive; `lead` untouched).
- [src/lib/analytics.ts](../src/lib/analytics.ts) — shared `track()` gtag helper for islands.
- [src/islands/PassSignIn.tsx](../src/islands/PassSignIn.tsx) — "Get your Adventure Pass" magic-link
  request; renders a fail-open notice when unconfigured.
- [src/islands/PassDashboard.tsx](../src/islands/PassDashboard.tsx) — the single hydrated island
  (`client:only`) that owns the member-vs-anon decision and the magic-link callback.
- [src/islands/PassProfileForm.tsx](../src/islands/PassProfileForm.tsx) — optional post-login profile.
- [src/pages/pass.astro](../src/pages/pass.astro) — `noindex, follow` member entry point.

**Magic-link callback:** the link returns the guest to `/pass` with a token in the URL; supabase-js
`detectSessionInUrl` (default on) parses it and fires `onAuthChange('SIGNED_IN')`, which flips the
dashboard to the member view. No dedicated callback route is required; the URL token is then cleared
from the address bar.

---

## 3. Offline verification — quality gate

| Check | Result |
|---|---|
| `npm run build` | ✅ 25 pages |
| `npm run typecheck` (`astro check`) | ✅ 55 files, 0 errors / 0 warnings / 0 hints |
| `npm run lint` (eslint) | ✅ clean |
| `npm run format:check` (prettier) | ✅ clean |
| Visual regression (`npm run test:visual`) | ✅ **12/12** — zero change to the SEO pages |

## 4. Offline verification — browser (Playwright)

Driven in a real Chromium browser against the production `dist/`. Two builds: the committed env-unset
build (fails-open) and a throwaway **dummy-Supabase** build (`isSupabaseConfigured=true`) with the
Supabase OTP endpoint mocked for deterministic success/error.

**Fails-open (env unset) — 2/2:**

| Test | Result |
|---|---|
| `/pass` renders the "almost here" notice, no form, **no page error** | ✅ PASS |
| Public `/` unaffected — loads, not redirected to `/pass` | ✅ PASS |

**Configured join form (dummy env, OTP mocked) — 4/4:**

| Test | Result |
|---|---|
| Join form renders (not the coming-soon notice) | ✅ PASS |
| Empty submit → "Please enter a valid email." + `pass_signup_error{reason:validation}`; no request | ✅ PASS |
| Valid email + OTP 200 → "Check your inbox." + `pass_signup_request` + `pass_signup_sent` | ✅ PASS |
| Valid email + OTP 500 → error message + `pass_signup_error{reason:backend}` | ✅ PASS |

**Profile creation is lazy.** `member_profile` rows are created **after** authentication, only when the
optional profile form is first submitted (`saveProfile` upsert). Authentication (the `auth.users` row)
does **not** auto-create a profile row — an authenticated member with no `member_profile` row is a
valid state (`getProfile` returns `null`; the form renders empty). This keeps identity and profile data
independent, per ADR-006.

**Not covered offline (honest gap):** the authenticated *member view* (post-login dashboard, profile
save, sign-out) needs a real Supabase session, which can't be minted headlessly. Its code paths are
straightforward and typechecked; they are verified live in §7.

---

## 5. Analytics — event catalogue (M2)

All via the shared `track()` helper, `{ transport_type: 'beacon' }`, no-op until GA4 is configured.

| Event | Trigger | Payload |
|---|---|---|
| `pass_signup_request` | magic-link send **attempt** (valid email, request dispatched) | `{ transport_type }` |
| `pass_signup_sent` | magic link **sent** successfully | `{ transport_type }` |
| `pass_signup_error` | send blocked or failed | `{ transport_type, reason: 'validation' \| 'backend' }` |
| `pass_profile_saved` | optional profile saved | `{ transport_type }` |
| `pass_profile_error` | profile save failed | `{ transport_type, reason: 'backend' }` |
| `pass_signout` | member signs out | `{ transport_type }` |

Buckets: signup **attempts** vs **sends** vs **failures**, plus profile completion and sign-out — the
signup-funnel signal ADR-006 calls out as decision-driving.

---

## 6. Regression risk

**Very low, contained by design.**
- `/pass` is the only page importing any auth code; auth JS never ships on the 23 SEO pages → CWV
  unaffected, visual regression **12/12** green.
- No public page gates on login; `/pass` fails open (unconfigured or Auth-down → friendly notice, no
  crash). A member/auth outage therefore cannot take down the marketing site or lead capture.
- Additive only: `database.types.ts` extended (not restructured); no migration, schema, RLS, or grant
  change (the `member_profile`/`itinerary` tables, RLS `prof_own`/`itin_own`, and `authenticated`
  grants already existed from M1's 001/002/004).
- **Rollback:** reverting the `feature/m2-identity` merge removes `/pass` and all auth code with zero
  effect on public pages (nothing links to `/pass`, nothing imports its code). Documented in
  STAGING_CHECKLIST §E; drill is a live step (§7).

---

## 7. Live runbook (operator — execute against the provisioned project)

Prerequisites: `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` in `.env`/Pages env; a verified
sending domain (Resend/Supabase SMTP) so magic-link email is deliverable (ADR-006); and the redirect
allowlist below. Checklist: [STAGING_CHECKLIST.md §D/§E](STAGING_CHECKLIST.md).

**Redirect URL allowlist (Supabase → Auth → URL Configuration).** `sendMagicLink` sets
`emailRedirectTo = window.location.origin + '/pass'` ([auth.ts](../src/lib/auth.ts)), so the origin the
guest requests from must be allowlisted **exactly** (path `/pass`), or Supabase falls back to Site URL.

| Env | Redirect URL |
|---|---|
| Dev (`astro dev`, default port) | `http://localhost:4321/pass` |
| Preview harness (`astro preview`) | `http://localhost:4331/pass` *(only if you test the flow via preview)* |
| Production | `https://bestwesternvernalinn.com/pass` |
| Cloudflare Pages previews (optional) | `https://*.<project>.pages.dev/pass` |

**Site URL** = `https://bestwesternvernalinn.com`.

1. **New account / magic link:** at `/pass`, request a link with a fresh email → email arrives →
   click → lands on `/pass` **signed in** (member view). A new `auth.users` row exists. **Screenshot.**
2. **Session persists:** refresh `/pass` → still signed in. Close/reopen tab → still signed in.
3. **Returning user:** sign out, request a link with the **same** email → same user (no duplicate).
4. **Optional profile:** on the member view, save "why visiting" → a `member_profile` row for your
   `user_id` appears (Table editor); re-open `/pass` → the form is pre-filled. `pass_profile_saved`
   in GA4. **Screenshot** the row.
5. **Logout:** Sign out → returns to the join view; refresh → still logged out.
6. **Expiry / invalid token:** click an expired or reused link → graceful failure (no crash), can
   request a fresh link.
7. **Public unaffected:** while logged out, browse the 23 SEO pages + `/corporate-rates` → none
   redirect or gate. While logged in, same.
8. **Fail-open under outage (§E):** temporarily point at a bad Supabase URL → `/pass` shows the
   fail-open notice; public pages + lead form still work. Restore.
9. **Rollback drill (§E):** confirm reverting the auth merge restores the last-known-good site with no
   data loss.
10. **Analytics:** in GA4 DebugView, confirm `pass_signup_request/sent/error`, `pass_profile_saved`,
    `pass_signout` with `transport_type: beacon`. **Screenshot.**

---

## 8. Unresolved issues & recommendations

1. **Member-view live verification pending (§7.1–7.6)** — the post-login surface can only be proven
   against a live session. Blocking for M2 sign-off.
2. **Redirect-URL allowlist + SMTP deliverability are load-bearing** (ADR-006). If magic-link emails
   land in spam or the redirect isn't allowlisted, login silently fails — verify both first (§7 prereq).
3. **No return-path preservation yet.** The guard is single-surface (`/pass` is the entry). When
   future member-only routes are added (guides, itineraries — M3/M4), add a guard that redirects
   logged-out guests to `/pass` and back. Not needed for M2's single surface.
4. **Profile is intentionally minimal** (`user_types`, `visit_reason`, `marketing_optin`). `interests`,
   `display_name`, and arrival/departure dates exist in the schema but are deferred to when a feature
   consumes them — avoid collecting data nothing uses yet.

## 9. Screenshots required (attach on live execution)
- Signed-in `/pass` member view after a real magic-link click (§7.1)
- New `auth.users` row + `member_profile` row in the Table editor (§7.1/§7.4)
- GA4 DebugView showing the M2 events (§7.10)
