# Local Supabase Setup — Adventure Pass (M2/M4)

A single, practical path from a fresh checkout to a **working Adventure Pass sign-in** on your local machine: magic-link auth, favorites, and the trip planner persisting against a real Supabase project.

**Scope.** This covers the member-facing identity + trip features (M2/M4). The lead-capture pipeline (corporate form → `lead` table → email Worker) is a separate concern documented in [PROVISIONING.md](PROVISIONING.md). The two overlap only on "create a project / set env / run migrations."

**Why this doc exists — two repository-specific facts you won't guess:**

1. This repo does **not** use the standard Supabase CLI layout (`supabase/config.toml`, `supabase/migrations/`). Migrations live in `database/migrations/` and are applied by hand via the **SQL Editor**. `supabase db push` will not pick them up.
2. Database verification (`npm run verify:db`) needs a live connection string (`SUPABASE_DB_URL`) **and** `psql` on PATH. On Windows you'll usually run the SQL check files in the Supabase SQL Editor instead.

No application code changes are required at any point — provisioning is pure configuration. Until it's done, the app correctly shows *"The Adventure Pass is almost here"* and every public page keeps working.

---

## 1. Prerequisites

- A **Supabase** account and a project (free tier is fine for local testing).
- This repo checked out, with **Node** and dependencies installed (`npm install`).
- `.env.example` present at the repo root (it is — it's the template).
- The local dev server runnable: `npm run dev`.

---

## 2. Create `.env`

Copy the template and fill in the two **public** values:

```bash
cp .env.example .env
```

```
PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<your-anon-publishable-key>
```

These are **public, browser-safe** keys by design — the anon key is meant to be shipped to the client and is protected by Row-Level Security. `.env` is gitignored, so real values never get committed.

Get both from **Supabase → Project Settings → API**: copy the **Project URL** and the **anon / publishable** key.

> **Do not** put the **service_role** key in a `PUBLIC_*` variable. It bypasses RLS and must never reach the browser. (It's only needed later for `SUPABASE_DB_URL`-based tooling, never for the sign-in UI.)

---

## 3. Enable Email Authentication

In **Supabase → Authentication**:

1. **Providers → Email** — enable it. (Magic links are email OTP; no password.)
2. **URL Configuration** — add the local dev origin and the Pass redirect target:

   ```
   http://localhost:4321
   http://localhost:4321/pass
   ```

Port **4321** is Astro's default (this repo sets no custom port). The magic link returns the guest to `${origin}/pass`, where the SDK establishes the session automatically. Add your preview/production origins here too when you deploy.

---

## 4. Apply the Database Schema

> This repo does **not** use the Supabase CLI migration layout, so `supabase db push` is **not** the path here. Apply the migrations by hand in the **SQL Editor**.

In **Supabase → SQL Editor**, paste and run each file **in numeric order**:

| Order | File | What it adds |
|------|------|--------------|
| 1 | `database/migrations/001_schema.sql` | Extensions + all base tables |
| 2 | `database/migrations/002_rls.sql` | Row-Level Security policies |
| 3 | `database/migrations/003_functions.sql` | RPC functions + triggers |
| 4 | `database/migrations/004_grants.sql` | Least-privilege grants (load-bearing for RLS) |
| 5 | `database/migrations/005_favorite.sql` | M4 `favorite` table |

Order matters: `001` enables the `uuid-ossp`, `postgis`, and `vector` extensions and creates the tables the later files depend on. Every `create table` uses `if not exists`, so **re-running a migration on an already-provisioned database is safe** — it won't error or duplicate.

Seed data is **not required** for Adventure Pass testing (favorites/itineraries/profiles don't depend on it).

---

## 5. Verify Tables

In **Database → Tables**, confirm these **10** tables exist:

```
destination      location        location_edge   member_profile
itinerary        partner         offer           event
lead             favorite
```

**Decision tree:**

- **0 tables** → nothing applied yet — run all five migrations (§4).
- **9 tables, no `favorite`** → run only `005_favorite.sql`.
- **10 tables** → schema is provisioned — continue.

The three tables M4 actually exercises are `member_profile`, `itinerary`, and `favorite`.

---

## 6. Verify the Database (structure + RLS)

Two ways — pick whichever your machine supports.

**Option A — `npm run verify:db`** (needs `psql` on PATH):

```bash
SUPABASE_DB_URL="postgres://...session-pooler-uri..." npm run verify:db
```

Get the URI from **Project Settings → Database → Connection string** (session/pooler). The script runs `database/tests/schema_checks.sql` and `rls_checks.sql` and exits non-zero if any check reports `FAIL`.

**Option B — SQL Editor** (no `psql` needed; recommended on Windows):

Run these two files and confirm **every line prints `PASS`**:

- `database/tests/schema_checks.sql` — extensions, 10 tables, functions, policies, RLS flags.
- `database/tests/rls_checks.sql` — isolation checks; wraps itself in a rolled-back transaction, so it leaves no data behind.

Both are **read-only** — they change nothing.

---

## 7. Restart Astro

Environment variables are read at startup, so a running dev server won't see a newly edited `.env`:

```bash
# stop the current server (Ctrl+C), then:
npm run dev
```

Reload `/pass`. You should now see the **email input + "Get my Adventure Pass" button** instead of the "almost here" placeholder. If you still see the placeholder, `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` aren't being read — see Troubleshooting.

---

## 8. Live Verification Checklist

Run these against the live project (this is the M4 §7 acceptance set):

- [ ] **Magic-link email** — submit your email; the link arrives.
- [ ] **Login** — clicking the link lands on `/pass` signed in.
- [ ] **Favorites** — heart an attraction; it persists across reload.
- [ ] **Trip planner** — set arrival/departure/interests; an itinerary generates and saves.
- [ ] **Refresh** — session survives a page reload.
- [ ] **Logout / Login** — sign out, sign back in; state is intact.
- [ ] **Second account** — sign in as a different email.
- [ ] **RLS isolation** *(load-bearing)* — member B **cannot** read member A's `favorite` or `itinerary` rows.
- [ ] **Analytics** *(optional)* — with GA4 configured, events fire in DebugView.

---

## 9. Troubleshooting

**"The Adventure Pass is almost here" still showing.**
Cause: `PUBLIC_SUPABASE_URL` and/or `PUBLIC_SUPABASE_ANON_KEY` are missing or blank, so `isSupabaseConfigured` is `false`.
Fix: set both in `.env`, then **restart** `npm run dev`.

**Magic link email never arrives.**
Check the Email provider is enabled (§3) and look in spam. On the free tier Supabase's built-in email is rate-limited; configure a custom SMTP sender for heavier testing.

**Clicking the link errors or doesn't sign you in.**
The link's origin must be in **Authentication → URL Configuration** (§3). Add both `http://localhost:4321` and `http://localhost:4321/pass`.

**`verify:db` says `psql not found`.**
Use Option B (SQL Editor) — no `psql` required.

**A `schema_checks.sql` line prints `FAIL`.**
That line names the missing object (table/extension/function/policy). The usual cause is a skipped or out-of-order migration — re-run §4 top to bottom.

---

## 10. Common Mistakes

- **Forgetting to restart Astro after editing `.env`.** Env is read once at startup; edits to a running server have no effect. Stop and re-run `npm run dev`.
- **Applying migrations out of order.** Later files depend on `001`'s extensions and tables. Always run `001 → 002 → 003 → 004 → 005`.
- **Using the service_role key where the anon key belongs.** `PUBLIC_SUPABASE_ANON_KEY` must be the **anon/publishable** key. The service_role key bypasses RLS and must never be exposed to the browser.
- **Expecting `supabase db push` to work.** It won't — this repo has no `supabase/` CLI layout. Apply migrations in the SQL Editor (§4).
- **Skipping `004_grants.sql`.** Grants are what make RLS enforce least privilege; without them the RLS isolation test (§8) won't behave as expected.
- **Adding redirect URLs with a trailing slash or wrong port.** Match `http://localhost:4321/pass` exactly (default Astro port, no trailing slash).

---

## Completion Criteria

Provisioning is complete when:

- Authentication works (magic link → signed-in session).
- The database schema exists (all 10 tables present).
- Verification passes (`npm run verify:db` green, or every SQL check reports `PASS`).
- `/pass` shows the sign-in form instead of the "almost here" placeholder.
- Favorites and itineraries persist across reloads and RLS isolates members.
