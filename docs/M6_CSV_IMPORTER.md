# M6 — Partner Report CSV Importer

Status: **in build (Phase A).** This document is the operational reference for the
off-browser partner-report CSV importer. It is written incrementally alongside the
[implementation checklist](M6_CSV_IMPORTER_CHECKLIST.md); sections marked _(later task)_
are stubs until their task lands. The full usage/exit-code/PII reference and the **locked**
CSV column contract are completed in **T17**, after behaviour is final and Best Western has
confirmed its export format.

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

### 1.2 ⚠️ Open precondition — schema migration not yet in the repo

As of this writing, `database/migrations/` ships **`hotel_report`** (the original
hotel-specific header table, migration 006) but **not** `partner_report` /
`partner_report_line`. The approved M6 design renames/generalises that header table
(`hotel_report` → `partner_report`, partner-type-agnostic) and adds the per-line table.

**That migration is a T01 precondition and is out of scope for the importer build itself**
(the checklist authors no migrations). It must be authored — in the self-contained
`002/004/005/006` style: table + RLS + grants, idempotent — and applied to staging before
Phase E (persistence, T12–T14) can be validated. Phase A (scaffolding) and Phases B–D
(parser, validation, dry-run) do **not** touch the database and are unblocked by this gap.

Tracking: this is the single open item blocking the write path; everything up to
Checkpoint D (dry-run) can proceed without it.

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

## 4. Usage, env, exit codes, PII handling  _(later task — T17)_

Completed once the CLI (T10), dry-run (T11), and write path (T15) are final.
Until then, see the [checklist](M6_CSV_IMPORTER_CHECKLIST.md) for the intended behaviour.
