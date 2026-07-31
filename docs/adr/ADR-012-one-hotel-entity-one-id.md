# ADR‑012 — One Hotel Entity, One `@id`

**Status:** Accepted · 2026‑07 · (implemented in `src/data/schema.ts`, enforced by `npm run verify:schema`)

## Context
Structured data was migrated from the legacy HTML **verbatim, as opaque template strings**. That was
the right call for the migration — it guaranteed no SEO regression — but it meant the JSON-LD never
passed through `business.ts`, the file whose entire purpose is making a NAP mismatch impossible.

An audit of the built output found six hotel nodes across five pages, none carrying an `@id`:

| Page | Node | Name | Telephone |
|---|---|---|---|
| `index` | `Hotel`+`LodgingBusiness` | Best Western Vernal Inn | +14357896625 |
| `dog-friendly-hotel-vernal` | `LodgingBusiness` | Best Western **Extended Stay** Vernal | **+18015971696** |
| `naples-utah-hotel` | `LodgingBusiness` | Best Western **Extended Stay** Vernal | +14357896625 |
| `oilfield-housing-vernal` | `LodgingBusiness` | Best Western **Extended Stay** Vernal | **+18015971696** |
| `explore` | nested `isPartOf` / `worksFor` | Best Western **Extended Stay** Vernal | — |
| `faq` | nested `worksFor` | Best Western **Extended Stay** Vernal | — |

Two names and two phone numbers for one hotel, all live. This is not a duplication problem that costs
some crawl budget — it asks Google to decide **which of two businesses** each page is about, and it
does so on exactly the commercial pages the site most needs to rank. Address was also inconsistent:
three nodes omitted `streetAddress` and `postalCode` entirely.

## Decision
1. **One canonical node, one `@id`.** `HOTEL_ID = https://bestwesternvernalinn.com/#hotel` — domain‑rooted,
   not page‑rooted, because the entity is the hotel, not a URL. Durable contract: **never edit it**;
   changing it creates a second entity, which is the failure this ADR exists to end.
2. **`src/data/schema.ts` is the only place a hotel node is constructed.** Every value comes from
   `business.ts` / `rates.ts`. Nothing is restated. A page may never hand-write a hotel node.
3. **Three functions, deliberately not one.**
   - `hotelNode()` — identity: who and where. Safe on any page.
   - `hotelNodeFull()` — identity **plus** offers, `aggregateRating`, `starRating`, imagery. **Homepage
     only.** These are wider claims; propagating them to four more pages under cover of a refactor would
     be widening published claims without anyone deciding to (ADR‑008).
   - `hotelRef()` — `{@type, @id}` and nothing else, for nested mentions (`worksFor`, `isPartOf`).
4. **A page that references the hotel also emits `hotelNode()`**, so the reference resolves within that
   page's own markup instead of dangling on a cross-page `@id`.
5. **`Best Western Extended Stay Vernal` is retained as `alternateName`, not deleted.** Google has
   already crawled it. An explicit alias reconciles the two strings into one entity; silent removal
   leaves a competing one in the index with nothing pointing at it.
6. **Offers are generated from `RATES`, and a `null` rate emits no Offer.** Same publication gate as
   `usd()` rendering "Call for pricing" — an unconfirmed number never becomes a published claim.

`scripts/verify-schema-entity.mjs` parses the built HTML and **exits non-zero** on more than one `@id`,
name, or telephone, or on any hotel node lacking an `@id`. It fails closed because conflicting NAP is a
truth failure, not a maintenance one ([ADR‑008](ADR-008-truth-gates-fail-closed.md),
[ADR‑009](ADR-009-freshness-never-blocks-publication.md)).

## Consequences
- **Positive:** `business.ts` now actually governs structured data. A phone-number change propagates to
  every schema block on the next build — previously it would have missed all six.
- **Positive:** 221 lines of hand-maintained JSON-LD deleted. New commercial pages get correct identity
  by importing one function.
- **Positive:** The regression has a named guard. Copying an old page's schema block into a new page —
  the exact move that produced this — now fails `verify:schema`.
- **Resolved:** the telephone conflict. `+14357896625` is confirmed by the owner (2026‑07‑31) as the
  number used for booking, so it is correct as the canonical NAP phone and `business.ts` needs no
  change. The `+18015971696` that two pages published is therefore wrong *for schema* regardless of its
  origin. Still worth one question to the GM before launch: was it a call-tracking or campaign number?
  If so, restoring it anywhere is a deliberate marketing decision — never in NAP, and never by
  reverting this consolidation.
- **Cost:** `alternateName` carries a legacy string that is probably wrong. It should be removed once
  the legal entity is verified from the franchise records; until then, removing it would be guessing.
- **Open dependency:** the *correct* hotel name is unconfirmed. `business.ts` says "Best Western Vernal
  Inn"; five nodes said otherwise; page **prose and FAQ answers still say "Best Western Extended Stay
  Vernal"** in several places. Prose was left untouched deliberately — the resolution is a business
  document, not a find-and-replace. See `docs/BUSINESS_KNOWLEDGE_WORKBOOK.md`.
- **Reversibility:** high. `schema.ts` is additive; pages could re-inline their blocks, though nothing
  would be gained.

Relates to: [ADR‑001](ADR-001-repository-is-source-of-truth.md),
[ADR‑008](ADR-008-truth-gates-fail-closed.md) (why the verifier fails closed),
[ADR‑011](ADR-011-editorial-data-separate-from-rendering.md) (same pattern: data owns the facts,
the page only renders them).
