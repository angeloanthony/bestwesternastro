# Destination Page Standard

Every destination page on this site must satisfy this checklist before it is considered
finished. The reference implementation is
[`src/pages/hotel-near-ashley-national-forest.astro`](../src/pages/hotel-near-ashley-national-forest.astro).

The goal is stated once, and everything below follows from it:

> **A destination page should be genuinely useful to a visitor even if the hotel did not exist.**
> Hotel relevance is present, but secondary.

## The editorial rule

> Everything that can be verified is **cited or traceable**.
> Everything that comes from local experience is **explicitly reviewed by someone with that
> experience** before publication.

Blurring those two is the failure mode. A researched fact presented as first-hand observation
is a fabrication, however plausible it reads.

## The checklist

| # | Requirement | Enforced by |
|---|---|---|
| 1 | **Entity clearly identified** — the page names precisely which place it is about, including state and county, and distinguishes it from similarly-named places elsewhere | `verify:pages` (heading + disambiguation) · human |
| 2 | **Geographic relationships explained** — how the place relates to Vernal, to the hotel, and to neighbouring destinations | human |
| 3 | **Official sources cited** — numbered `<sup>` markers in the body, resolved in a visible Sources list of primary sources (agency sites, not aggregators) | `verify:pages` |
| 4 | **Seasonal information included** — what changes by season, and what closes | `verify:pages` (section present) · human |
| 5 | **Planning section included** — how long to allow, what to combine it with, what to bring, connectivity, weather | `verify:pages` (section present) · human |
| 6 | **FAQ included** — real questions a visitor asks, answered plainly | `verify:pages` |
| 7 | **Structured data validated** — every JSON-LD block parses; the place has a `Place`/entity block with `sameAs` to authoritative sources; no URL in structured data redirects | `verify:pages` |
| 8 | **Front Desk insights reviewed** — or absent; never placeholder text | `FrontDeskInsight.astro` (renders nothing unless reviewed) |
| 9 | **No unsupported claims** — no invented distances, hours, prices, or "locals say" content; regulations are linked, never restated | human |
| 10 | **Hotel relevance present but secondary** — the hotel section earns its place by answering a real trip-planning question | human |

Run `npm run verify:pages` for the mechanical items. The rest are a human read.

## Why regulations are linked, never restated

Hunting seasons, permit quotas, fees and closures change annually and vary by unit. Restating
them creates a page that is confidently wrong the moment it goes stale, and getting a regulation
wrong has real consequences for a guest. Link the agency:

- **U.S. Forest Service** — forest use, fire restrictions, road and trail closures
- **National Park Service** — park hours, fees, shuttle operation, road status
- **Utah Division of Wildlife Resources** — fishing and hunting licences, seasons, units
- **Recreation.gov** — campground availability, reservations, fees

Fee *amounts* published by an agency may be quoted with a citation and a review date, because
a visitor genuinely needs them to plan. Season dates and quotas may not.

## The Front Desk workflow

Four standing prompts, asked of whoever staffs the desk
(see [`src/data/frontDeskInsights.ts`](../src/data/frontDeskInsights.ts)):

1. What do guests most often ask about this place?
2. What mistake do visitors commonly make?
3. What do locals recommend that guidebooks miss?
4. What changes seasonally that surprises people?

Set `reviewed: true` with `reviewedBy` and `reviewedOn` to publish. Until then the component
renders nothing — an unreviewed placeholder cannot leak onto the live site.

Re-review annually. Local knowledge decays like any other record.

## Page skeleton

```
1. What this place is            — entity, scale, defining features, disambiguation
2. How far it is from Vernal     — distances and drive times, stated as approximate
3. Which access route to use     — named options, what each is for
4. Things to do
5. Seasonal planning
6. Permits and regulations       — links only
7. Planning your visit           — days needed, combinations, packing, connectivity
8. Staying in Vernal             — hotel relevance, last and shortest
   [Front Desk insights]         — gated
   FAQ
   Sources                       — visible, numbered, primary
```
