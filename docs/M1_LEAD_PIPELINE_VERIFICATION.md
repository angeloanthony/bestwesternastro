# M1 — Lead Pipeline Verification (Application Layer)

**Date:** 2026-07-11 · **Branch:** `feature/foundation-scaffold` · **Type:** offline (code + browser) verification
**Scope:** the anonymous lead pipeline `browser → (Supabase | mailto) → email → analytics`, i.e. the last
three unchecked boxes of **M1** in [ROADMAP.md](ROADMAP.md) (lead pipeline, analytics) that gate the
`v0.4-infrastructure-verified` tag. The database layer itself is already verified in
[M1_VERIFICATION_REPORT.md](M1_VERIFICATION_REPORT.md).

> **Milestone note.** The originating prompt called this "M2." The repository's own scheme
> (source of truth per [TECHNICAL_BASELINE.md](TECHNICAL_BASELINE.md) §0) assigns lead-pipeline +
> analytics verification to **M1**, and reserves **M2 for passwordless identity**
> ([ADR-006](adr/ADR-006-passwordless-identity.md)) — which this work does not touch. Recorded here
> as M1 completion; M2 (Identity) is left untouched.

> **Environment limitation (why some rows read BLOCKED, not PASS).** This run executed in a
> non-interactive environment with **no `.env`, no live Supabase/Resend/GA4 access, and no `psql`**.
> Every hop that can be proven from code or a real browser against the built site was proven here and
> marked **PASS**. Every hop that requires the live backend is marked **BLOCKED — needs live creds**
> (not PASS), with an exact runbook in §7 for the operator to execute. Nothing below is assumed green.

---

## 1. Summary

| # | Objective | Result |
|---|---|---|
| 1 | CorporateRateForm end-to-end (validation, loading, success, error, duplicate) | ✅ PASS (offline) |
| 2 | Supabase insertion — exactly one `lead` row with correct fields | ⏳ BLOCKED — needs live creds (§7.1) |
| 3 | Anonymous client uses **only** the anon key; no service-role key exposed | ✅ PASS |
| 4 | RLS: anon may INSERT; cannot SELECT / UPDATE / DELETE | ✅ PASS statically (002+004); ⏳ live re-run BLOCKED (§7.1) |
| 5 | Fallback: Supabase unavailable → mailto still works, no lead lost | ✅ PASS |
| 6 | Notification pipeline (Resend / Worker) | ⏳ BLOCKED — needs deployed Worker + Resend (§7.2) |
| 7 | Analytics: GA4 event fires / conversion event / error event | ✅ PASS (offline) — 3 distinct events (attempt / success / error) verified; live GA4 delivery ⏳ (§7.3) |

**Bottom line:** the application code is correct and safe on every axis provable offline. The three
live hops (real DB insert, email delivery, GA4 in DebugView) remain to be executed by the operator
against the provisioned project — they are **not** yet green, so the `v0.4-infrastructure-verified`
tag is **not** yet earned.

---

## 2. Objective 1 — CorporateRateForm end-to-end (offline)

Driven in a real Chromium browser (Playwright) against the production build (`dist/`) served via
`astro preview`, with Supabase env **unset** so the form takes the mailto fallback path. 4/4 passed:

| Test | Expected | Result |
|---|---|---|
| Empty submit | blocked client-side; "Please enter your name." + "Please enter a valid email." inline; no success panel | ✅ PASS |
| Invalid email (`foo@`, `foo`, `foo@bar`) with valid name | blocked; "Please enter a valid email." inline | ✅ PASS |
| Valid submit | reaches success panel "Request received." (live region, offers phone fallback) | ✅ PASS |
| Repeat submit | form unmounts to success panel → submit button gone; no client-side double-send, no crash | ✅ PASS |

**Loading + error states (by code inspection — too transient / backend-dependent to assert in the
mailto path):**
- **Loading:** [CorporateRateForm.tsx:234-238](../src/islands/CorporateRateForm.tsx#L234-L238) — button
  `disabled` and label switches to "Sending…" while `status === 'submitting'`. ✅ present.
- **Error:** [CorporateRateForm.tsx:60-64,226-230](../src/islands/CorporateRateForm.tsx#L60-L64) — a
  Supabase insert error sets `status='error'` and renders "Something went wrong: … Please call us
  instead." This branch is only reachable with a live Supabase that returns an error, so it is
  **BLOCKED for live confirmation** (force it in §7.1 by temporarily pointing at a bad key).

**Validation logic** ([CorporateRateForm.tsx:35-42](../src/islands/CorporateRateForm.tsx#L35-L42)):
required = non-empty `contact_name` + regex-valid `email`; the form is `noValidate` so the island owns
validation. Correct.

---

## 3. Objective 3 — Anon-key-only client / no service-role exposure  ✅ PASS

- [src/lib/supabase.ts](../src/lib/supabase.ts) reads **only** `PUBLIC_SUPABASE_URL` +
  `PUBLIC_SUPABASE_ANON_KEY`. No other key is referenced client-side.
- Grep of `src/` for `SERVICE_ROLE | service_role | serviceRole`: **0 matches** in client code. The
  service-role key appears only in [.env.example](../.env.example) (documentation) and the
  [lead-notify Worker](../workers/lead-notify.ts) `Env` (server-side, never bundled).
- **Built-output scan of `dist/`:** no `service_role` / `RESEND_API` / `ANTHROPIC` strings; **no
  concrete `*.supabase.co` project URL**; **no JWT-shaped anon key** (`eyJ…`). (Env was unset for this
  build, so no creds could be baked in — confirming the graceful-degradation path also ships no
  secrets.) The only "supabase" strings in `dist/` are the vendored `@supabase/*` SDK internals.

---

## 4. Objective 4 — RLS behaviour (static)  ✅ PASS statically

Anon capabilities on `lead`, double-gated by the table GRANT (coarse) and RLS (row):

| Op | Table GRANT to `anon` ([004](../database/migrations/004_grants.sql)) | RLS policy ([002](../database/migrations/002_rls.sql)) | Net effect |
|---|---|---|---|
| INSERT | ✅ granted | `lead_insert … with check (true)` | ✅ allowed (the form path) |
| SELECT | granted (deliberately) | **no select policy → default-deny** | query runs, returns **0 rows** (privacy) |
| UPDATE | **not granted** | no policy | ❌ denied |
| DELETE | **not granted** | no policy | ❌ denied |

This exactly matches the live behavioural checks already recorded in
[M1_VERIFICATION_REPORT.md](M1_VERIFICATION_REPORT.md) §2 (anon insert not denied; anon read of leads
= 0 rows). The reason SELECT is granted at the table level (so RLS returns 0 rows rather than
`permission denied`) is documented in [004_grants.sql:31-36](../database/migrations/004_grants.sql#L31-L36).
A live re-run of [rls_checks.sql](../database/tests/rls_checks.sql) is the operator step in §7.1.

---

## 5. Objective 5 — Fallback  ✅ PASS

When `isSupabaseConfigured` is false, [leads.ts:16-24](../src/lib/leads.ts#L16-L24) returns
`{ via: 'mailto', href }` and [CorporateRateForm.tsx:65-68](../src/islands/CorporateRateForm.tsx#L65-L68)
sets `window.location.href` to the pre-filled `mailto:` before showing the success panel — the user's
message is never lost. Proven in the browser run (§2, "valid submit" test executed on this exact path).
The mailto is addressed to `BUSINESS.email` and carries every field
([leads.ts:26-44](../src/lib/leads.ts#L26-L44)).

---

## 6. Objective 7 — Analytics  ✅ PASS (offline); live delivery ⏳ (§7.3)

**Wiring** ([Analytics.astro](../src/components/Analytics.astro), rendered once in `<head>` by
BaseLayout): GA4 `gtag` loads **only** when `PUBLIC_GA4_MEASUREMENT_ID` is set (dormant by default).
The attempt/call/book events use a delegated click listener that fires
`gtag('event', <data-track>, { transport_type: 'beacon' })` for any `[data-track]` element; the
outcome events (success/error) are fired directly by the island via a local `track()` helper
([CorporateRateForm.tsx:12-24](../src/islands/CorporateRateForm.tsx#L12-L24)). Both mechanisms no-op
until `gtag` is present.

**Every event name, trigger, and payload (documented as required):**

| Event | Source | Trigger | Payload |
|---|---|---|---|
| `corporate_lead_submit` | [CorporateRateForm.tsx](../src/islands/CorporateRateForm.tsx) `data-track` on the submit button | submit button **clicked** (attempt — fires regardless of outcome) | `{ transport_type: 'beacon' }` |
| `corporate_lead_success` | island `track()` after `submitLead` resolves ok | submission **succeeds** — Supabase insert ok **or** mailto fallback prepared | `{ transport_type: 'beacon', via: 'supabase' \| 'mailto' }` |
| `corporate_lead_error` | island `track()` | submission **fails** — client validation blocks it **or** the backend rejects it | `{ transport_type: 'beacon', reason: 'validation' \| 'backend' }` |
| `call_click` | [StickyBookingBar.astro:21](../src/components/StickyBookingBar.astro#L21) | sticky-bar phone tapped | `{ transport_type: 'beacon' }` |
| `book_click` | [StickyBookingBar.astro:29](../src/components/StickyBookingBar.astro#L29) | sticky-bar "Book Now" tapped | `{ transport_type: 'beacon' }` |

This gives three distinguishable buckets: **attempts** (`corporate_lead_submit`), **conversions**
(`corporate_lead_success`), **failures** (`corporate_lead_error`, split by `reason`) — far more useful
than counting button clicks.

**Offline verification (browser, `gtag` stubbed before hydration):**

| Case | Expected events | Result |
|---|---|---|
| Valid submit (env unset → mailto) | `corporate_lead_submit`, then `corporate_lead_success{ via: 'mailto' }`; **no** error | ✅ PASS |
| Empty submit | `corporate_lead_error{ reason: 'validation' }`; **no** success | ✅ PASS |
| Backend error | `corporate_lead_error{ reason: 'backend' }` | ⏳ needs a live Supabase error (§7.1.5); code path symmetric to the validation case |

**Live GA4 delivery** (does it actually reach GA4 DebugView with `transport_type: beacon`) still
requires a GA4 property — operator step §7.3.

---

## 7. Live runbook (operator — execute against the provisioned project)

These are the hops this environment cannot reach. Run them in order; each is a checkbox in
[STAGING_CHECKLIST.md §B/§C](STAGING_CHECKLIST.md).

### 7.1 Real DB insert + RLS (BLOCKED here)
1. Put `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` in local `.env`; `npm run build`.
2. Serve (`npm run preview`), open `/corporate-rates`, submit a valid request.
3. Supabase → Table editor → `lead`: confirm **exactly one** new row; verify `kind`, `contact_name`,
   `company`, `email`, `phone`, `notes`, `source_page = /corporate-rates`, `created_at`. **Screenshot** the row.
4. Re-run RLS proof: `SUPABASE_DB_URL=… npm run verify:db` (needs `psql`), or paste
   [rls_checks.sql](../database/tests/rls_checks.sql) into the SQL editor — expect all **PASS**. **Screenshot** the notices.
5. **Error state:** temporarily set a bad anon key, submit, confirm the red "Something went wrong…"
   message renders (objective 1 error branch). Restore the key.

### 7.2 Notification pipeline (BLOCKED here)
1. Deploy [lead-notify Worker](../workers/lead-notify.ts); set secrets `RESEND_API_KEY`,
   `FRONT_DESK_EMAIL`, `LEAD_WEBHOOK_SECRET`, `FROM_EMAIL` (see [PROVISIONING.md](PROVISIONING.md)).
2. Create a Supabase Database Webhook on `INSERT` into `lead` → the Worker URL, header
   `x-webhook-secret: <LEAD_WEBHOOK_SECRET>`.
3. Submit a lead; `wrangler tail` should show the POST; Resend dashboard shows the send; **the
   front-desk inbox receives it** with correct fields and `reply_to = submitter`. **Screenshot** the email.

### 7.3 Analytics (BLOCKED here)
1. Set `PUBLIC_GA4_MEASUREMENT_ID` (+ `PUBLIC_CALLRAIL_ID`), rebuild.
2. In GA4 DebugView / Realtime, confirm `corporate_lead_submit`, `call_click`, `book_click` arrive with
   `transport_type: beacon`; confirm CallRail number-swap. **Screenshot** DebugView.

---

## 8. Unresolved issues & recommendations

1. **(Objective 7) Distinct conversion + error events — IMPLEMENTED (2026-07-11).**
   `corporate_lead_success` (on the `done` state, `via: supabase|mailto`) and `corporate_lead_error`
   (`reason: validation|backend`) are now fired by the island in addition to the existing
   `corporate_lead_submit` attempt event. Localized to `CorporateRateForm.tsx`; no UI/logic/schema/RLS
   change. Verified offline (§6). Only live GA4 DebugView delivery remains (§7.3).
2. **Live hops (§7) not yet executed** → `v0.4-infrastructure-verified` **not** taggable. Blocking for
   M1 sign-off.
3. **Build warning (benign):** `The JSX import source cannot be set without also enabling React's
   "automatic" JSX transform` on [CorporateRateForm.tsx:1](../src/islands/CorporateRateForm.tsx#L1).
   The `@jsxImportSource preact` pragma is redundant given the `@astrojs/preact` integration already
   configures the automatic runtime; the island builds and hydrates correctly. Optional cleanup:
   drop the pragma.
4. **Island weight:** `CorporateRateForm` ships ~217 KB (bundles the full `@supabase/supabase-js`
   incl. auth-js, though the form only inserts). Not a blocker; consider a lighter direct `fetch` to
   the REST endpoint, or lazy-loading the SDK, if bundle size on `/corporate-rates` matters later.
5. **No anti-spam** on anon insert (already tracked in ROADMAP "Lead spam controls" / STAGING_CHECKLIST
   §B). Add a honeypot or Turnstile before insert when bot traffic appears.

## 9. Screenshots required (to attach on live execution)
- `lead` row in the Supabase Table editor (§7.1.3)
- `rls_checks.sql` / `verify:db` all-PASS output (§7.1.4)
- Front-desk email received, fields + reply-to correct (§7.2.3)
- GA4 DebugView showing the three events (§7.3.2)
