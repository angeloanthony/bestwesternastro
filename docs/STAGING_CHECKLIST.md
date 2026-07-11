# Staging Checklists

Manual verification to run against the **live** backend before building on top of it. Ordered to match the pause plan: provision → prove the lead pipeline → analytics → then Prompt 5 auth.

---

## A. Supabase provisioning (Prompt 4 activation)

- [ ] Production project created (Pro tier — no pausing)
- [ ] Dev project created (if budget allows) — separate env for safe testing
- [ ] Extensions enabled: `postgis`, `vector`, `uuid-ossp`
- [ ] Migrations applied in order: `001_schema` → `002_rls` → `003_functions`
- [ ] Seed applied: `database/seed/001_destination.sql` (vernal destination exists)
- [ ] **RLS verified** — run `database/tests/rls_checks.sql`, all checks print PASS
- [ ] Env set in Cloudflare Pages + local `.env`: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`

## B. Lead pipeline end-to-end (prove before adding auth)

Submit at `/corporate-rates` and verify each hop:

- [ ] Form → Supabase: a row appears in `lead` (Table editor)
- [ ] Supabase → Worker: webhook fires (Worker logs / `wrangler tail`)
- [ ] Worker → Email: Resend shows the send
- [ ] Email received by the front-desk inbox, with correct fields + reply-to = submitter
- [ ] `source_page` on the row = `/corporate-rates`

Input cases (behaviour should be sane, not crash):

- [ ] Valid submission → success state shown, row written
- [ ] Missing required fields (name/email) → blocked client-side, no submit
- [ ] Invalid email (`foo@`, `foo`, `foo@bar`) → blocked, inline error
- [ ] Extremely long notes (10k+ chars) → accepted or gracefully truncated, no error
- [ ] Duplicate submissions (same data twice) → both captured (dedupe is a later concern; confirm no crash)
- [ ] Spam-like input (URLs, script tags in notes) → stored as text, not executed anywhere it's displayed
- [ ] Supabase env UNSET → form falls back to mailto (regression check of the fallback)

> Note: there is **no rate-limiting / captcha** on lead insert yet (RLS allows anon insert). If bot spam appears, add a honeypot field or a Turnstile check before the insert. Tracked, not built.

## C. Analytics (verify before real traffic)

Set `PUBLIC_GA4_MEASUREMENT_ID` (+ `PUBLIC_CALLRAIL_ID`), rebuild, then in GA4 DebugView / Realtime:

- [ ] Call-click fires `call_click` (sticky bar phone + any `tel:` with `data-track`)
- [ ] Book-click fires `book_click` (sticky bar Book Now)
- [ ] Corporate submit fires `corporate_lead_submit` (form button)
- [ ] Events carry `transport_type: beacon` and are not lost on navigation
- [ ] CallRail number-swap replaces the displayed phone number

## D. Adventure Pass auth (Prompt 5 — do NOT check until built)

Passwordless, magic-link only (see ADR-006):

- [ ] Magic link received
- [ ] Link expires correctly (reuse after expiry fails)
- [ ] Repeat login works (request a second link)
- [ ] New account created on first login
- [ ] Existing account reused (same email → same user)
- [ ] Logout works
- [ ] Session persists after refresh
- [ ] Session expires correctly
- [ ] Private pages protected (dashboard redirects when logged out)
- [ ] Public pages unaffected (the 23 SEO pages + conversion layer never gate)
- [ ] Optional profile completion after login (never blocks signup)
