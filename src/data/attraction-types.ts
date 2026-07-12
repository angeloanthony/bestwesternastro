// src/data/attraction-types.ts
//
// Shared catalogue TYPES only (no data). Split out so the generated catalogue
// (attractions.generated.ts) and the public interface (attractions.ts) can both
// import them without a circular value dependency. See attractions.ts.

/** Interest tags. Kept in lockstep with the INTERESTS taxonomy in attractions.ts
 *  (enforced there with `satisfies`) and with `member_profile.interests`. */
export type InterestId =
  | 'dinosaurs'
  | 'outdoors'
  | 'water'
  | 'history'
  | 'scenic'
  | 'family'
  | 'dining';

/** How long a stop realistically takes — drives how many fit in a day. */
export type Duration = 'quick' | 'half-day' | 'full-day';

/** How far from the hotel — drives day sequencing (in-town on arrival/departure,
 *  day-trips on full days). */
export type Area = 'in-town' | 'nearby' | 'day-trip';

export type Attraction = {
  /** Stable, append-only identifier. Stored in `favorite.attraction_slug` and
   *  in generated itinerary stops. Matches `location.slug` in the database. */
  slug: string;
  name: string;
  emoji: string;
  /** Short category label shown on the card. In the DB this is the location's
   *  `categories[]` joined with ' · '. */
  category: string;
  area: Area;
  /** Drive time from Best Western Vernal Inn, in minutes (`location.drive_minutes`). */
  driveMinutes: number;
  duration: Duration;
  interests: InterestId[];
  /** One-line blurb shown on the card (`location.ai_summary`). */
  blurb: string;
  /** Where "Learn more" points — an existing on-site page (`location.learn_more_href`).
   *  Never a URL that changes an existing page (ADR-002). */
  href: string;
  /** Editorial priority (1 = highest) for ranking ties (`location.priority`). */
  priority: number;
};
