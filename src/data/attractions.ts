// src/data/attractions.ts
//
// SINGLE SOURCE OF TRUTH for the Vernal attraction catalogue used by the
// Adventure Pass (M4 — Saved Adventures, My Adventures, and the Trip Planner).
//
// WHY THIS LIVES IN TYPESCRIPT (not the `location` table)
// -------------------------------------------------------
// The Postgres `location` table exists (migration 001) but is intentionally
// EMPTY — populating it is the Knowledge Base track (locations · search ·
// embeddings), a separate, not-yet-built milestone. M4 must not depend on it.
// So the catalogue is a static TS module (the same pattern as `business.ts`
// for NAP): additive, deterministic, and shippable today.
//
// Every field below is lifted VERBATIM from copy already published on the site
// (src/pages/explore.astro and things-to-do-vernal-utah.astro) — nothing was
// invented. Drive times are the ones already stated on those pages. No GPS or
// AI summaries are fabricated here.
//
// MIGRATION PATH (documented for the Knowledge Base milestone): when `location`
// is seeded, give each row a `slug` matching the `slug` here; `favorite` and
// `itinerary` then reference real location IDs and this file is retired. The
// slugs are the stable contract — treat them as append-only.

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
] as const;

export type InterestId = (typeof INTERESTS)[number]['id'];

/** How long a stop realistically takes — drives how many fit in a day. */
export type Duration = 'quick' | 'half-day' | 'full-day';

/** How far from the hotel — drives day sequencing (in-town on arrival/departure,
 *  day-trips on full days). */
export type Area = 'in-town' | 'nearby' | 'day-trip';

export type Attraction = {
  /** Stable, append-only identifier. Stored in `favorite.attraction_slug` and
   *  in generated itinerary stops. */
  slug: string;
  name: string;
  emoji: string;
  /** Short category label shown on the card (matches the site's card copy). */
  category: string;
  area: Area;
  /** Drive time from Best Western Vernal Inn, in minutes — as stated on-site. */
  driveMinutes: number;
  duration: Duration;
  interests: InterestId[];
  /** One-line blurb, condensed from the published card copy. */
  blurb: string;
  /** Where "Learn more" points — an existing on-site page (keeps guests planning
   *  on our site) or, where no on-site page exists, the explore hub. Never a URL
   *  that changes an existing page. */
  href: string;
  /** Editorial priority (1 = highest) for ranking ties — mirrors the emphasis the
   *  site itself gives each attraction (Dinosaur NM is the "crown jewel"). */
  priority: number;
};

export const ATTRACTIONS: Attraction[] = [
  {
    slug: 'dinosaur-national-monument',
    name: 'Dinosaur National Monument',
    emoji: '🦕',
    category: 'National Monument',
    area: 'day-trip',
    driveMinutes: 20,
    duration: 'full-day',
    interests: ['dinosaurs', 'outdoors', 'scenic', 'family', 'history'],
    blurb:
      'The crown jewel — the Quarry Exhibit Hall puts you face-to-face with 1,500+ dinosaur bones in the cliff face, plus canyon hikes and the Green River.',
    href: 'hotel-near-dinosaur-national-monument.html',
    priority: 1,
  },
  {
    slug: 'flaming-gorge',
    name: 'Flaming Gorge',
    emoji: '🔥',
    category: 'National Recreation Area',
    area: 'day-trip',
    driveMinutes: 40,
    duration: 'full-day',
    interests: ['water', 'outdoors', 'scenic', 'family'],
    blurb:
      '200,000+ acres of red canyon and emerald reservoir with world-class fishing, boating, and the Flaming Gorge–Uintas National Scenic Byway.',
    href: 'hotel-near-flaming-gorge.html',
    priority: 2,
  },
  {
    slug: 'red-fleet-state-park',
    name: 'Red Fleet State Park',
    emoji: '🦶',
    category: 'State Park · Hiking',
    area: 'nearby',
    driveMinutes: 12,
    duration: 'half-day',
    interests: ['water', 'outdoors', 'dinosaurs', 'family'],
    blurb:
      '"Little Lake Powell" — hike the Dinosaur Trackway to 200-million-year-old footprints, then swim or kayak the sandstone reservoir.',
    href: 'hotel-near-red-fleet-state-park.html',
    priority: 3,
  },
  {
    slug: 'utah-field-house-museum',
    name: 'Utah Field House of Natural History',
    emoji: '🏛️',
    category: 'Museum · State Park',
    area: 'in-town',
    driveMinutes: 5,
    duration: 'half-day',
    interests: ['dinosaurs', 'history', 'family'],
    blurb:
      'Walk through 200 million years of geologic time. Life-sized dinosaur replicas outside, real fossils and a working prep lab inside. Right in downtown Vernal.',
    href: 'explore.html#adventures',
    priority: 4,
  },
  {
    slug: 'mcconkie-ranch-petroglyphs',
    name: 'McConkie Ranch Petroglyphs',
    emoji: '🪨',
    category: 'Historic Site · Petroglyphs',
    area: 'nearby',
    driveMinutes: 15,
    duration: 'half-day',
    interests: ['history', 'outdoors', 'scenic'],
    blurb:
      'Near-life-sized Fremont-era figures carved into canyon sandstone — some of the finest rock art in the American West. Free trail, best in morning light.',
    href: 'explore.html#adventures',
    priority: 5,
  },
  {
    slug: 'moonshine-arch',
    name: 'Moonshine Arch',
    emoji: '🌉',
    category: 'Hiking · Nature',
    area: 'nearby',
    driveMinutes: 8,
    duration: 'half-day',
    interests: ['outdoors', 'scenic', 'family'],
    blurb:
      'A 40-foot sandstone arch just 8 miles from town — an easy 2-mile round-trip hike with shaded caverns perfect for a picnic. Rarely crowded.',
    href: 'explore.html#adventures',
    priority: 7,
  },
  {
    slug: 'steinaker-state-park',
    name: 'Steinaker State Park',
    emoji: '🌊',
    category: 'State Park · Water',
    area: 'nearby',
    driveMinutes: 10,
    duration: 'half-day',
    interests: ['water', 'outdoors', 'family'],
    blurb:
      'Swimming, wakeboarding, kayaking, and camping around a quiet reservoir minutes from town — far fewer crowds than Red Fleet.',
    href: 'explore.html#outdoors',
    priority: 8,
  },
  {
    slug: 'fantasy-canyon',
    name: 'Fantasy Canyon',
    emoji: '🏜️',
    category: 'Scenic Wonder',
    area: 'day-trip',
    driveMinutes: 60,
    duration: 'half-day',
    interests: ['scenic', 'outdoors'],
    blurb:
      'Otherworldly sandstone formations that look like another planet. About an hour south, accessible by passenger car — extraordinary near sunset.',
    href: 'explore.html#adventures',
    priority: 9,
  },
  {
    slug: 'jones-hole-fish-hatchery',
    name: 'Jones Hole Fish Hatchery',
    emoji: '🐟',
    category: 'Nature · Hiking',
    area: 'day-trip',
    driveMinutes: 30,
    duration: 'half-day',
    interests: ['outdoors', 'family', 'water'],
    blurb:
      'A working hatchery with thousands of trout, then a creek-side trail through canyon walls to Ely Creek Waterfall. Kids love the fish.',
    href: 'explore.html#adventures',
    priority: 10,
  },
  {
    slug: 'green-river-rafting',
    name: 'Green River Rafting',
    emoji: '🚣',
    category: 'Rafting · Adventure',
    area: 'day-trip',
    driveMinutes: 20,
    duration: 'full-day',
    interests: ['water', 'outdoors'],
    blurb:
      'Raft the legendary Green River through the canyons of Dinosaur National Monument. Single- and multi-day guided trips with local outfitters.',
    href: 'explore.html#outdoors',
    priority: 11,
  },
  {
    slug: 'mccoy-flats-trails',
    name: 'McCoy Flats Trail Network',
    emoji: '🚵',
    category: 'Mountain Biking',
    area: 'nearby',
    driveMinutes: 15,
    duration: 'half-day',
    interests: ['outdoors', 'scenic'],
    blurb:
      '100+ miles of mountain biking across McCoy Flats, Red Fleet, and the aspen-lined Dry Fork Flume Trail — all without the Moab crowds.',
    href: 'explore.html#outdoors',
    priority: 12,
  },
  {
    slug: 'dinaland-golf',
    name: 'Dinaland Golf Course',
    emoji: '⛳',
    category: 'Golf',
    area: 'in-town',
    driveMinutes: 5,
    duration: 'half-day',
    interests: ['outdoors', 'scenic'],
    blurb:
      'An 18-hole public course set against high-desert scenery, well-maintained and reasonably priced — a perfect morning before the canyons.',
    href: 'explore.html#outdoors',
    priority: 13,
  },
  {
    slug: 'downtown-vernal',
    name: 'Downtown Vernal',
    emoji: '🍽️',
    category: 'Dining · Local Life',
    area: 'in-town',
    driveMinutes: 5,
    duration: 'quick',
    interests: ['dining', 'family', 'history'],
    blurb:
      'A genuine small-town Main Street — top-rated Italian, Thai, Mexican and BBQ, craft beer across from the museum, and local shops worth a slow walk.',
    href: 'explore.html#restaurants',
    priority: 6,
  },
];

/** Fast lookup by slug (favorites and itinerary stops are stored by slug). */
export const ATTRACTION_BY_SLUG: Record<string, Attraction> = Object.fromEntries(
  ATTRACTIONS.map((a) => [a.slug, a]),
);

export function getAttraction(slug: string): Attraction | undefined {
  return ATTRACTION_BY_SLUG[slug];
}
