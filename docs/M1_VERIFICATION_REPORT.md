# M1 — Infrastructure Verification Report (Database Layer)

**Date:** 2026-07-11 · **Branch:** `feature/foundation-scaffold` · **Type:** live-database verification
**Result:** ✅ **Database layer VERIFIED** against a live Supabase project — schema, functions, RLS, and table privileges all confirmed. ⏳ The `v0.4-infrastructure-verified` **tag is NOT yet earned**: the anonymous lead pipeline, email notification, and analytics remain to verify (application-level).

---

## 1. What changed since Prompt 4

Prompt 4 delivered the SQL **authored but not executed** (no live Postgres in that env — see [PROMPT4_VALIDATION_REPORT.md §1](PROMPT4_VALIDATION_REPORT.md)). This report records the first **live execution** of those migrations against a provisioned Supabase project, and the one real defect it caught.

## 2. Verification results (Supabase SQL editor)

| Layer | Check | Result |
|---|---|---|
| Extensions | `uuid-ossp`, `postgis`, `vector` present | ✅ PASS |
| Tables | all 9 (`destination` … `lead`) present | ✅ PASS |
| Functions | `set_updated_at`, `season_contains`, `is_open_now`, `nearby`, `match_locations`, `rebuild_near_edges` | ✅ PASS |
| Policies | `loc_public_read`, `event_public_read`, `offer_public_read`, `prof_own`, `itin_own`, `lead_insert` | ✅ PASS |
| RLS enabled | `location`, `member_profile`, `itinerary`, `lead`, `event`, `offer` | ✅ PASS |
| Seed | `vernal` destination loaded | ✅ PASS |
| Privileges | grant matrix matches least-privilege model (§4) | ✅ PASS (after `004`) |

**RLS behavioural checks** ([database/tests/rls_checks.sql](../database/tests/rls_checks.sql), run as `anon`, rolled back):

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | anon reads published only | 1 row | ✅ PASS (got 1) |
| 2 | anon can insert a lead | not denied | ✅ PASS |
| 3 | anon cannot read leads | 0 rows | ✅ PASS (got 0) |
| 4 | anon cannot insert a location | denied | ✅ PASS |

## 3. The defect verification caught — and why `004_grants.sql` exists

**Symptom:** `rls_checks.sql` failed with `permission denied for table location` — before any RLS policy was evaluated.

**Investigation (facts, not guesses):**
- Table owner = `postgres`; default ACL granted `anon`/`authenticated`/`service_role` `arwdDxtm`. On paper, tables created by `postgres` should have inherited full DML.
- Yet the tables carried only `REFERENCES/TRIGGER/TRUNCATE` — **no `SELECT/INSERT/UPDATE/DELETE`** for the application roles. RLS policies (002) and schema (001) were both correct; the gap was purely the **privilege layer**.

**Root cause:** the application tables did not inherit the project's default privileges (mechanism inconclusive; the explicit-grant fix makes correctness independent of it).

**Resolution:** [database/migrations/004_grants.sql](../database/migrations/004_grants.sql) — states the privilege baseline explicitly. `001`/`002`/`003` left untouched as historical record.

## 4. The privilege model (least-privilege, stricter than Supabase defaults)

| Table | anon | authenticated | service_role | Rationale |
|---|---|---|---|---|
| destination, location_edge | SELECT | SELECT | ALL | public reference, no RLS → read-only |
| location, event, offer | SELECT | SELECT | ALL | RLS filters rows (published/active) |
| lead | SELECT, INSERT | SELECT, INSERT | ALL | INSERT = form; SELECT so RLS (no read policy) returns 0 rows instead of `permission denied` |
| member_profile, itinerary | — | CRUD | ALL | RLS: own rows only (M2) |
| partner | — | — | ALL | **withheld**: no RLS + contact PII; expose via a view if public offer display needs it |

Three deliberate calls, all in the `004` header comments: **(a)** `lead` needs SELECT (not INSERT-only) or `rls_checks` test #3 errors; **(b)** the three no-RLS tables are SELECT-only so anon can never mutate an unprotected table; **(c)** `partner` is withheld to avoid leaking `contact_email`/`contact_name` to the anon role.

## 5. Still required before the `v0.4-infrastructure-verified` tag

Per the M1 milestone definition — **do not tag until these pass:**

- [ ] Anonymous lead pipeline: corporate form on the live site → row in `lead`
- [ ] Email notification: `lead-notify` Worker → Resend → front-desk inbox
- [ ] Analytics: GA4 events fire correctly
- [ ] Then: `git tag -a v0.4-infrastructure-verified` + draft GitHub Release

Member-scoped policies (`prof_own`/`itin_own`) require an authenticated JWT and are deferred to **M2 / Prompt 5** (blocked until the above are green).

## 6. Re-verify (once psql is installed)

```bash
SUPABASE_DB_URL=postgres://... npm run verify:db   # runs schema_checks + rls_checks, exits non-zero on any FAIL
```

Until psql is on PATH, the canonical fallback is pasting `database/tests/schema_checks.sql` and `rls_checks.sql` into the Supabase SQL editor. Note: the checks report via `raise notice` — confirm the editor surfaces notices, or use rows-returning equivalents.
