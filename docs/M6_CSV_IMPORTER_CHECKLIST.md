# Milestone 6 — CSV Importer: Implementation Checklist

Build-ready task list for the partner-report CSV importer. Tasks are small (≈30–90 min),
independently testable, and ordered by dependency. **Planning only — no production code, no
migrations authored here.** Do not redesign the approved architecture.

## Conventions
- Off-browser CLI in the existing script-tooling pattern (`booking-report.mjs` / `verify-db.mjs`):
  plain `.mjs`, ESM, Node ≥22.12, run with the **service-role key**. Not fail-open — atomic, aborts on error.
- Targets the approved schema: `partner_report` (header) + `partner_report_line` (`status='unmatched'`).
  **No writes** to `booking_intent`; **no** `commission` rows. No matching.
- Unit tests use built-in `node:test`; CLI args via `node:util` `parseArgs`; hashing via `node:crypto`.

## Cross-cutting design guardrails (keep pilot-focused yet multi-partner-safe)
- Core modules (reader, validate, persist) stay **profile-driven** — zero hotel-specific logic.
- Canonical field names are **generic** (`quantity` + `unit_label`, `service_start/end`), never `room_nights`.
- `partner_slug` is parametric everywhere; a new partner = a new profile object, no core change.
- Only **one** profile (Best Western) is built now; the registry shape must accept more.

## ⛔ Tasks blocked by the Best Western CSV contract
**T01, T04, T05b, T14 (doc section)** cannot be finalized until BW confirms exact headers, date format,
currency format, and encoding. They can be *scaffolded* against a provisional contract but not locked.

---

## Phase A — Setup

### T01 — Precondition & CSV-contract intake  ⛔ contract-blocked
- **Objective:** Confirm the approved schema (`partner_report`, `partner_report_line`) is applied; capture the BW CSV column contract (headers, date fmt, currency fmt, encoding).
- **Files affected:** `docs/M6_CSV_IMPORTER.md` (contract section — provisional/TBD if unconfirmed).
- **Dependencies:** none.
- **Expected outcome:** A `SELECT` against both tables returns empty (not error); a written column contract (marked provisional if BW hasn't confirmed).
- **Validation steps:** Query both tables via service role → no error; contract section exists with every canonical field mapped or flagged TBD.

### T02 — Scaffolding, npm script, gitignore
- **Objective:** Create the `scripts/report-import/` module dir, add the `report:import` npm script, decide `csv-parse` dependency vs. vendored reader, add `reports/inbox/` to `.gitignore`.
- **Files affected:** `package.json`, `.gitignore`, `scripts/report-import/` (new dir), `scripts/import-report.mjs` (usage stub).
- **Dependencies:** none.
- **Expected outcome:** `npm install` clean; `npm run report:import` prints usage and exits non-zero.
- **Validation steps:** Run the script with no args → usage text + non-zero exit; confirm `reports/inbox/` is ignored (`git status` clean after dropping a file there).

> **Checkpoint A:** Tables exist, project scaffold runs, dependency decision locked.

---

## Phase B — Parser

### T03 — Canonical record contract
- **Objective:** Define the canonical line-record shape (field names mirroring `partner_report_line` columns) as the single contract shared by parser/validate/persist.
- **Files affected:** `scripts/report-import/canonical.mjs`.
- **Dependencies:** T01 (column names), T02.
- **Expected outcome:** A factory/typedef exporting `{ external_ref, customer_name, promo_code, service_start, service_end, quantity, unit_label, revenue_cents, currency, raw }`.
- **Validation steps:** `node:test` — factory returns all expected keys; import resolves; names match the approved schema exactly.

### T04 — Best Western partner profile  ⛔ contract-blocked
- **Objective:** `profiles.mjs` with a slug-keyed registry and the BW profile: header→canonical map, date coercer, currency→cents coercer, `unit_label='room_nights'`, `getProfile(slug)`.
- **Files affected:** `scripts/report-import/profiles.mjs`.
- **Dependencies:** T03; **BW contract** (exact headers/formats).
- **Expected outcome:** `getProfile('best-western-vernal')` returns a complete mapping; unknown slug → `null`.
- **Validation steps:** `node:test` — mapping covers every required canonical field; coercers convert sample date/currency values correctly; registry accepts a second dummy profile without core edits.

### T05a — CSV reader
- **Objective:** Reader step in `parser.mjs`: read file, strip BOM, RFC-4180 parse (quoted fields, embedded commas/newlines, CRLF) → `{ headers, rows[] }` with consistent column-count detection.
- **Files affected:** `scripts/report-import/parser.mjs`.
- **Dependencies:** T02.
- **Expected outcome:** `readCsv(text)` returns headers + row objects; ragged rows flagged.
- **Validation steps:** `node:test` fixtures — quoted commas, embedded newline, BOM, CRLF, ragged row all handled.

### T05b — Synthetic fixtures  ⛔ contract-blocked
- **Objective:** Create a synthetic BW sample CSV plus edge-case fixtures (dup confirmation, bad date, negative revenue, nights/date mismatch, extra column). **No real guest PII.**
- **Files affected:** `scripts/report-import/fixtures/` (or `reports/inbox/` samples).
- **Dependencies:** T04 (headers/format); **BW contract**.
- **Expected outcome:** A fixture set that later validation/persistence tests reuse.
- **Validation steps:** Fixtures parse under T05a; headers match the BW profile; no real PII present.

### T06 — Canonical transform
- **Objective:** Apply the profile to raw rows → canonical records, retaining the original row as `.raw`. Pure, no I/O.
- **Files affected:** `scripts/report-import/parser.mjs`.
- **Dependencies:** T03, T04, T05a, T05b.
- **Expected outcome:** `parse(text, profile)` → canonical[] with cents/dates coerced, `unit_label` set, `raw` preserved.
- **Validation steps:** `node:test` on fixtures — correct field mapping, integer cents, ISO dates, raw retained.

> **Checkpoint B (PARSER COMPLETE):** A BW CSV parses to canonical records with raw retained; all parser tests green.

---

## Phase C — Validation

### T07 — File & header validation
- **Objective:** `validate.mjs`: file exists/non-empty/UTF-8/`.csv`/size cap; required headers present per profile; extra columns → warnings.
- **Files affected:** `scripts/report-import/validate.mjs`.
- **Dependencies:** T04, T06.
- **Expected outcome:** `validateStructure()` returns `{ errors, warnings }`.
- **Validation steps:** `node:test` — missing required header → fatal; empty file → fatal; extra column → warning.

### T08 — Row-level validation
- **Objective:** Per-row rules — `external_ref` present & unique-in-file (dup → fatal); dates valid & ordered; `quantity` positive int; `revenue` non-negative parse (negative → warn+flag); nights vs date-span → warn; arrival outside `--period` → warn. Collect **all** errors.
- **Files affected:** `scripts/report-import/validate.mjs`.
- **Dependencies:** T06, T07.
- **Expected outcome:** `validateRows()` returns a full manifest (never stops at first error).
- **Validation steps:** `node:test` — one fixture per rule; manifest lists every violation in a bad file.

> **Checkpoint C (VALIDATION COMPLETE):** Bad files produce a complete, actionable error manifest; good file passes clean.

---

## Phase D — Dedup, CLI, Dry-run

### T09 — Hashing & duplicate-detection helpers
- **Objective:** `sha256` of the raw file (`node:crypto`); natural-key query builder; hash-compare against an existing report's stored `raw_csv`; `source_note` hash-token format/parse. **No new schema columns.**
- **Files affected:** `scripts/report-import/dedup.mjs`.
- **Dependencies:** T01.
- **Expected outcome:** Pure hash fn + a decision fn: given existing rows + new hash → allow / block-duplicate / warn-overlap.
- **Validation steps:** `node:test` — identical bytes → identical hash; token round-trips; decision logic correct for exact-period, overlapping-period, and same-hash cases.

### T10 — CLI arg & env parsing
- **Objective:** `import-report.mjs` front matter: `parseArgs` for `--partner --period --file --source-note --operator --dry-run --replace`; env checks; usage; `--period 2026-06` → `period_start/end`; exit codes.
- **Files affected:** `scripts/import-report.mjs`.
- **Dependencies:** T02.
- **Expected outcome:** Missing/invalid args → usage + non-zero; period expands to month bounds.
- **Validation steps:** `node:test` or manual — missing `--file` → non-zero + usage; `--period 2026-06` → `2026-06-01..2026-06-30`.

### T11 — Dry-run orchestration
- **Objective:** Wire CLI → read → profile → parse → validate → print summary. `--dry-run` stops before any write (optional read-only dup check if creds present).
- **Files affected:** `scripts/import-report.mjs`.
- **Dependencies:** T06, T08, T10.
- **Expected outcome:** `--dry-run` prints parse + validation manifest, exits 0/non-zero by fatal presence, **zero writes**.
- **Validation steps:** Run against good sample → correct summary, exit 0; malformed → manifest + non-zero; confirm DB row counts unchanged.

> **Checkpoint D (DRY-RUN COMPLETE):** Full read path works end-to-end with no writes.

---

## Phase E — Persistence

### T12 — Header insert
- **Objective:** `persist.mjs`: init service-role client; insert `partner_report` (period, `received_at=now()`, `source_note` incl. hash token + warnings, `raw_csv` verbatim, `reconciled_by`); return `id`.
- **Files affected:** `scripts/report-import/persist.mjs`.
- **Dependencies:** T01, T09.
- **Expected outcome:** `insertReport(client, {...})` → `report_id`; `raw_csv` and hash token stored.
- **Validation steps:** Staging — row appears with correct fields; anon/authenticated `SELECT` returns nothing (RLS default-deny).

### T13 — Batched line insert
- **Objective:** Batch-insert `partner_report_line` (≈500/batch): `report_id`, `partner_slug`, `booking_intent_id=NULL`, `status='unmatched'`, `raw` jsonb, all canonical fields.
- **Files affected:** `scripts/report-import/persist.mjs`.
- **Dependencies:** T12, T06.
- **Expected outcome:** `insertLines(client, report_id, canonical[])` inserts every row.
- **Validation steps:** Staging — line count == file rows; spot-check mapping/cents; all `status='unmatched'`; **no** `commission` rows; `booking_intent` untouched.

### T14 — Compensating rollback
- **Objective:** On line-insert failure, delete the header (and any inserted lines) → no partial batch; surface error + non-zero exit.
- **Files affected:** `scripts/report-import/persist.mjs`.
- **Dependencies:** T12, T13.
- **Expected outcome:** A forced mid-batch failure leaves zero rows for that `report_id`.
- **Validation steps:** Inject a failing batch → confirm header + lines are gone; exit non-zero.

> **Checkpoint E (PERSISTENCE COMPLETE):** Writes are atomic; a failure leaves the DB clean.

---

## Phase F — Integration

### T15 — Write-path wiring + duplicate enforcement
- **Objective:** Connect dry-run path → dedup (T09) → persistence (T12–T14); implement `--replace` (void prior report+lines, then import); final summary (report_id, counts, warnings); exit codes.
- **Files affected:** `scripts/import-report.mjs`.
- **Dependencies:** T09, T11, T14.
- **Expected outcome:** Real import writes header+lines as `unmatched`; duplicate re-run aborts; `--replace` supersedes.
- **Validation steps:** Staging E2E — import sample (rows land `unmatched`); re-import same file → blocked; `--replace` → replaces cleanly.

### T16 — End-to-end acceptance matrix
- **Objective:** Run the full scenario set: happy path, malformed file, duplicate, overlapping period, mid-write failure rollback, dry-run/real parity.
- **Files affected:** none (uses fixtures).
- **Dependencies:** T15.
- **Expected outcome:** Every scenario behaves per spec; `booking_intent` and `commission` provably untouched.
- **Validation steps:** Scenario checklist each PASS; DB inspection confirms no cross-table writes and correct `unmatched` state.

> **Checkpoint F (IMPORTER FUNCTIONAL):** All acceptance scenarios pass on staging.

---

## Phase G — Documentation

### T17 — Usage docs + CSV contract lock  ⛔ contract section blocked
- **Objective:** Complete `docs/M6_CSV_IMPORTER.md`: usage, env, the **locked** CSV column contract, dedup/`--replace` behavior, exit codes, PII handling note.
- **Files affected:** `docs/M6_CSV_IMPORTER.md`.
- **Dependencies:** T15 (behavior final); **BW contract confirmed** (unblocks the contract section).
- **Expected outcome:** A teammate can run an import from the doc alone.
- **Validation steps:** Following only the doc, a fresh dry-run succeeds; peer review.

---

## Dependency summary
```
T01 ─┬─ T03 ─┬─ T04 ⛔ ─┬─ T05b ⛔ ─┐
     │       │          └───────────┤
     │       └─ T06 ─────────────────┼─ T07 ─ T08 ─┐
T02 ─┴─ T05a ─┘                      │              │
T02 ─ T10 ───────────────────────────┴─ T11 ───────┤
T01 ─ T09 ──────────────────────────────────────────┤
T01 ─ T12 ─ T13 ─ T14 ───────────────────────────────┴─ T15 ─ T16 ─ T17 ⛔
```
Critical path runs T01→T03→T04→T06→T08→T11→T15→T16. The BW contract gates T04/T05b (and the T17
doc section); everything downstream of T04 inherits that block, so **confirm the contract first** to
avoid stalling the critical path.
