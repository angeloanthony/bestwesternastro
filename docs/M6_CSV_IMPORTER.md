# M6 — Partner Report CSV Importer

Status: **implementation complete (T02–T16) — merge-ready.** This document is the
operational reference for the off-browser partner-report CSV importer. The pipeline
(parse → validate → dedup → persist, with rollback and `--replace`) is built and covered by
the test suite. **One dependency remains ⛔ contract-blocked:** the Best Western column
contract (§2) and its import profile await BW's confirmed export format, so the shipped CLI
has no registered partner profile yet and will report `no profile registered` until that
profile lands. The **locked** CSV column contract is finalized in **T17** once BW confirms.

The importer ingests a partner's monthly reservation report into staff-only tables. It does
**not** match, does **not** reconcile, and does **not** compute commission — every imported
line lands as `status='unmatched'` for a later matcher (a deliberately postponed milestone,
see [PARTNER_REFERRAL_ARCHITECTURE.md §5–6](PARTNER_REFERRAL_ARCHITECTURE.md)).

---

## 1. Precondition — approved schema must be applied (T01)

The importer targets the approved M6 schema, both staff-only (service-role-only, RLS
default-deny — same posture as `booking_intent` / `hotel_report` in
[006_booking_intent.sql](../database/migrations/006_booking_intent.sql)):

- **`partner_report`** — one row per imported file (the header): `partner_slug`,
  `period_start/end`, `received_at`, `source_note` (carries the file hash token + import
  warnings), `raw_csv` (verbatim, so a future matcher can re-run), `reconciled_by`.
- **`partner_report_line`** — one row per CSV data row: `report_id`, `partner_slug`,
  `booking_intent_id` (NULL until matched), `status='unmatched'`, `raw` (jsonb of the
  original row) plus the canonical fields (see §3).

### 1.1 Verification query (run on staging with the service-role key)

The importer must never be the thing that creates these tables. Before any import, confirm
both tables exist and are empty-readable (a `SELECT` returns **zero rows**, not an error).
This is a live-DB check — run it with the service-role key (it bypasses RLS); it cannot be
run offline:

```sql
-- Expect: both queries return 0 (no error). A "relation does not exist" error means the
-- schema migration has NOT been applied — stop and apply it first.
select count(*) from partner_report;
select count(*) from partner_report_line;
```

### 1.2 Schema migration — [`009_partner_report.sql`](../database/migrations/009_partner_report.sql)

The migration is in the repo: [`database/migrations/009_partner_report.sql`](../database/migrations/009_partner_report.sql)
creates both `partner_report` and `partner_report_line`. It is **additive and
backward-compatible** — it *creates* the partner-type-agnostic tables rather than renaming
`hotel_report` (migration 006), which is left in place. Self-contained in the `006` style
(tables + `report_id → partner_report(id) on delete cascade` + the `report_id` index + RLS
default-deny + `service_role`-only grants) and idempotent (`create table if not exists`), so
it is safe to re-run. Column names on `partner_report_line` mirror the canonical record
(§3) 1:1, `status` defaults to `'unmatched'` with a `check (status in ('unmatched','matched'))`,
and there are deliberately **no commission columns**.

Apply it to the target database (`supabase db push`) **before running the write path** — the
importer never creates these tables itself. The `--dry-run` read path touches no database and
needs no migration. Confirm it is applied with the §1.1 verification query.

---

## 2. CSV column contract — Best Western (T01, ⛔ provisional)

**Provisional — NOT locked.** Best Western has not yet confirmed exact headers, date format,
currency format, or encoding (the business dependency in
[PARTNER_REFERRAL_ARCHITECTURE.md §7](PARTNER_REFERRAL_ARCHITECTURE.md)). Every value below
is a placeholder to scaffold against; the profile built in **T04** must be re-checked and
this section **locked in T17** once BW confirms. Do not treat any mapping here as final.

| Canonical field (§3) | Provisional BW header | Provisional format | Status |
| --- | --- | --- | --- |
| `external_ref`   | `Confirmation #`  | free text, unique per row       | ⛔ TBD |
| `customer_name`  | `Guest Name`      | `Last, First`                   | ⛔ TBD |
| `promo_code`     | `Rate / Promo`    | free text (e.g. `ADVENTURE`)    | ⛔ TBD |
| `service_start`  | `Arrival`         | date — format TBD (`MM/DD/YYYY`?) | ⛔ TBD |
| `service_end`    | `Departure`       | date — format TBD               | ⛔ TBD |
| `quantity`       | `Nights`          | positive integer                | ⛔ TBD |
| `unit_label`     | _(constant)_      | `room_nights` (set by profile)  | ⛔ TBD |
| `revenue_cents`  | `Room Revenue`    | currency — format/symbol TBD    | ⛔ TBD |
| `currency`       | _(constant?)_     | `USD` assumed; confirm          | ⛔ TBD |

Encoding: assume UTF-8 (strip BOM). Delimiter: assume comma (RFC-4180). **Confirm both.**

### Questions to close with the Best Western property (unblocks T04, T05b, this section)

- [ ] Exact column headers and their order in the export.
- [ ] Date format (`MM/DD/YYYY`, `YYYY-MM-DD`, …) and timezone assumption.
- [ ] Currency format — symbol? thousands separator? cents included? negative/refund rows?
- [ ] File encoding (UTF-8 vs. Windows-1252) and delimiter (comma vs. tab/semicolon).
- [ ] Does one row = one stay (with a `Nights` count), or one row per night?

---

## 3. Canonical line record

The single field contract shared by parser → validate → persist, mirroring
`partner_report_line` columns. Defined in code in **T03** (`scripts/report-import/canonical.mjs`);
listed here so §2's mapping has a stable target. Field names are **generic** on purpose
(`quantity` + `unit_label`, not `room_nights`) so a non-hotel partner is just a new profile:

```
{ external_ref, customer_name, promo_code, service_start, service_end,
  quantity, unit_label, revenue_cents, currency, raw }
```

---

## 4. Usage, env, exit codes, PII handling

The CLI (T10), dry-run (T11), and write path (T15) are final; the behaviour below is what
ships. The **CSV column contract** in §2 is the one remaining ⛔ contract-blocked item, and
the write path also requires the BW import profile to be registered (see the status note).

### 4.1 Command

```
PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  npm run report:import -- --partner <slug> --period <YYYY-MM> --file <path> [options]
```

**Required:** `--partner <slug>` (partner registry slug), `--period <YYYY-MM>` (expands to
`period_start`/`period_end`), `--file <path>` (CSV to read — drop into `reports/inbox/`, which
is gitignored).

**Options:** `--operator <name>` (recorded as `reconciled_by`), `--replace` (supersede a prior
report for the same partner+period — see §4.3), `--dry-run` (parse + validate only, **no**
database writes), `-h` / `--help`.

### 4.2 Environment

The write path uses a **service-role** Supabase client and requires `PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS and is a server secret — never
put it in the site build or a browser. `--dry-run` performs no database work and needs
neither variable.

### 4.3 Duplicate detection & `--replace`

Before any write, the file's `sha256` (stored as a `sha256:<hex>` token inside `source_note`)
and its `partner+period` are checked against existing reports:

- **identical bytes already imported** → `block-duplicate`; blocked, no writes.
- **same period (or an overlapping period) with different content** → `warn-overlap`; blocked
  unless `--replace` is given, which voids the conflicting prior report(s) first (their lines
  cascade-delete) and then imports.

Every imported line lands as `status='unmatched'` with `booking_intent_id` NULL; the importer
never matches, reconciles, or computes commission.

### 4.4 Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success — imported (or a clean `--dry-run` with no fatal errors). |
| `1` | Fatal validation error, a blocked duplicate/overlap, or a runtime error (unreadable file, unknown partner, DB/persistence failure — the write is rolled back). |
| `2` | Usage error (missing/invalid arguments). |

### 4.5 PII handling

Guest names and the verbatim `raw` CSV rows land in `partner_report` / `partner_report_line`,
which are **staff-only**: RLS is enabled with no policy (default-deny) and access is granted
only to `service_role`, so the anon/authenticated keys can never read them. Source CSVs belong
in `reports/inbox/`, which — like all of `reports/` — is gitignored; never commit a real
partner file.
