// src/data/attractions.ts
//
// PUBLIC INTERFACE for the Vernal attraction catalogue used by the Adventure
// Pass (Saved Adventures, My Adventures, Trip Planner). The catalogue DATA now
// lives in the Postgres `location` table — the permanent Vernal Knowledge Base
// (M6) — and is compiled into `attractions.generated.ts` at build time by
// scripts/generate-catalogue.mjs. See docs/M6_KNOWLEDGE_BASE_VERIFICATION.md.
//
// This module keeps a STABLE public surface so nothing downstream changed when
// the source of truth moved from a hand-authored array to the database:
//   • the `Attraction` / `InterestId` / `Duration` / `Area` types,
//   • the `INTERESTS` taxonomy (UI + `member_profile.interests` — not per-
//     location data, so it stays hand-authored here),
//   • `ATTRACTIONS` / `ATTRACTION_BY_SLUG` / `getAttraction` — re-exported from
//     the generated module.
//
// Slugs are the durable contract (ADR-007): append-only, never renamed, so
// favorites and saved itineraries keep resolving.

export type { Attraction } from './attraction-types';
export type { InterestId, Duration, Area } from './attraction-types';

// The generated catalogue (source of truth = DB). Committed so the static build
// stays deterministic and offline-buildable; browse never fails-closed.
export { ATTRACTIONS, ATTRACTION_BY_SLUG } from './attractions.generated';

import { ATTRACTION_BY_SLUG } from './attractions.generated';
import type { Attraction, InterestId } from './attraction-types';

/** Interest tags. Shared by the catalogue AND `member_profile.interests` and the
 *  Trip Planner's interest picker — one taxonomy so ranking is consistent. */
export const INTERESTS = [
  { id: 'dinosaurs', label: 'Dinosaurs & fossils', emoji: '🦕' },
  { id: 'outdoors', label: 'Hiking & outdoors', emoji: '🥾' },
  { id: 'water', label: 'Lakes, boating & fishing', emoji: '🚤' },
  { id: 'history', label: 'History & petroglyphs', emoji: '🪨' },
  { id: 'scenic', label: 'Scenic drives & photography', emoji: '📸' },
  { id: 'family', label: 'Family friendly', emoji: '👨‍👩‍👧' },
  { id: 'dining', label: 'Food & local dining', emoji: '🍽️' },
] as const satisfies readonly { id: InterestId; label: string; emoji: string }[];

export function getAttraction(slug: string): Attraction | undefined {
  return ATTRACTION_BY_SLUG[slug];
}
