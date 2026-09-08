// src/data/rooms.ts
//
// SINGLE SOURCE OF TRUTH for the five detailed room pages under /rooms/.
//
// One entry per room on the hotel's September 2026 rate card. The page template
// (src/pages/rooms/[slug].astro) renders these verbatim — it contains no room
// facts of its own, so a correction here fixes the page, the hero reel link, the
// homepage rate table link, the related-room lists and the JSON-LD at once.
//
// ─────────────────────────────────────────────────────────────────────────────
// PRICES ARE NOT STORED HERE. Every rate is read out of src/data/rates.ts via
// nightlyQuote(), and every weekly line is the fixed WEEKLY_CALL_LINE. No weekly
// dollar amount is published anywhere on this site, and none may be derived from
// a nightly one — see the header of rates.ts.
// ─────────────────────────────────────────────────────────────────────────────
//
// PHOTOGRAPHY — THE EVIDENCE RULE
//
// The owner's room folders under public/images/<Room-Type>/ are NOT clean. A
// byte-for-byte hash of all 66 files found 16 duplicate groups, and the overlap
// crosses room types in both directions:
//
//   • The whole standard bathroom set (vanity, backlit mirror, tub/shower) is
//     filed under King-Studio, Double-Queen-Studio AND Pet-Friendly-Double-Queen.
//     It is one property-standard bathroom photographed once. Used on several
//     pages, captioned as the bathroom — never as something unique to a room.
//
//   • Double-Queen-Studio/Double-Queen11, 12 and 14 show a SINGLE KING bed, and
//     11 and 12 are also filed under Handicapped-Studio. They are not evidence of
//     the two-queen room and are excluded from that page.
//
//   • Pet-Friendly-Double-Queen/PetFriendly-Double-Queen12 is byte-identical to
//     King-Studio/King-Studio.jpeg — a king bed on carpet. Every genuine
//     pet-friendly photograph shows two beds on wood-style plank flooring, so
//     that file is a misfile. It is used ONLY on the Studio King page.
//
// RESHOOT, ROOM BY ROOM (started 2026-09-08 with the Studio Two Queen)
//
// The owner is re-photographing each room and delivering WebP straight into
// its folder, in pairs: a 1672×941 landscape frame and a 941×1672 "Phoneview"
// twin of the same angle for the phone hero. public/images/Double-Queen-Studio/
// now holds ONLY that new set — every old JPEG in it was removed except
// Double-Queen-Kitchenette.jpeg, which the Studio King page still borrows
// (retire it when that room is reshot). The duplicate-group findings below
// therefore no longer describe that folder; they still describe the others.
//
// The rule applied throughout: a photograph counts as evidence of a room when
// the folder and what is visible in the frame agree. Where a file is shared, it
// is marked `shared: true` and captioned for what it is (the standard bathroom,
// the studio's closet, the kitchenette) rather than sold as a room-specific
// feature.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE NUMBERED IMAGES ARE NOT PHOTOGRAPHS (reviewed 2026-09-03)
//
// public/images/*.webp — 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
// 50a, 51, 52, 53, 54 and the "a" variants — were all opened and inspected.
// Every one is a CGI render with a caption baked into the pixels ("Standard
// King Room", "Double Queen Suite Room", "Jacuzzi King Suite Room" …). Two are
// real photographs but have a person standing in frame (39a — a king bed on
// wood-style floors; 26 — a standard bathroom), which makes them unusable as
// room photography. 34 is the real lobby, not a room.
//
// None of them belong in the galleries below: a real photograph exists for four
// of the five rate-card rooms, and a render must never sit beside real
// photography where a guest would read it as the room they are booking.
//
// The homepage's own labels for these renders are unreliable and were NOT used
// as evidence — 47.webp is captioned "Standard King Suite Room" in the pixels
// but labelled "Standard King Room — Full View" in index.astro, and 53.webp is
// labelled both "Jacuzzi Double Queen Suite — View 2" and "Pet Friendly King
// Room" on the same page while its own baked caption reads "Standard KING —
// Pet Friendly". Only the baked caption and the visible contents were trusted.
//
// JACUZZI SUITE: renders only — 37.webp and 49.webp ("Jacuzzi King Suite
// Room"), 44.webp ("Jacuzzi Double Queen Suite Room"), 49a.webp (same, with a
// person). No real photograph of a jacuzzi suite exists in the asset set, and
// RATES has no confirmed nightly rate for it, so it gets no page here.
//
// CURATION (2026-09-03): the galleries below were cut from 50 candidate files
// to 37. Near-duplicate frames, the weaker of two shots of the same fixture,
// and every misfiled image were dropped. The standard applied was the one the
// hotel asked for: better eight excellent photographs than sixteen redundant
// ones. Each surviving frame shows something the others do not.
// ─────────────────────────────────────────────────────────────────────────────
//
// FEATURES AND COPY: everything below is either visible in a cited photograph,
// already published elsewhere on this site (the homepage rate table's occupancy,
// the FAQ's pet policy, schema.ts's amenity list), or recorded in
// docs/BUSINESS_KNOWLEDGE_WORKBOOK.md. Nothing is inferred. Bed dimensions,
// square footage, room counts and appliance specifications are NOT published
// because no source confirms them.

import {
  RATES,
  nightlyQuote,
  WEEKLY_CALL_LINE,
  type NightlyQuote,
} from './rates.ts';
import { BUSINESS } from './business.ts';

export type RoomPhoto = {
  /** Path from the site root, without the leading slash (matches legacy markup). */
  src: string;
  /** Gallery caption — describes only what is visible in the frame. */
  caption: string;
  /** Accessible alt text. */
  alt: string;
  /**
   * True when the same file also appears under another room type's folder.
   * Shared photographs are still shown — a guest wants to see the bathroom —
   * but their captions never present them as unique to this room.
   */
  shared?: boolean;
  /**
   * PHONE version of `src`, shot (not cropped) at 9:16. Used only by the hero
   * slideshow, where the stage on a phone is a 100vw × 52vh box that keeps
   * about half of a landscape frame's width. A frame without one simply shows
   * its landscape image at every width. The gallery tiles and the lightbox
   * never read it — they are landscape at every size.
   */
  portrait?: string;
  /**
   * Include this frame in the hero slideshow at the top of the page.
   *
   * Reserved for wide, room-level views of THIS room — the angles that tell a
   * guest what the space is like. Borrowed frames are never flagged, because a
   * hero slide is the least captionable place on the page.
   *
   * BATHROOMS ARE NEVER HERO SLIDES, however good the photograph. The hero
   * crops to a short, very wide band, and a 4:3 bathroom shot cropped that way
   * centres on the toilet — which is what the accessible page did on its first
   * build. They stay in the gallery, where the tile is 4:3 and captioned.
   *
   * A room with fewer than two flagged frames simply shows a still hero. That
   * is the Studio King today: its folder holds one room photograph and five of
   * the bathroom. See the photography requests in §2.6 of the workbook.
   */
  heroSlide?: boolean;
};

export type RoomFeature = {
  label: string;
  /** Where the claim comes from. Kept in the data so it can be audited later. */
  source: 'photo' | 'site' | 'workbook';
};

export type Room = {
  slug: string;
  /** The hotel's own rate-card name. */
  name: string;
  /** Short label for related-room lists and the homepage links. */
  shortName: string;
  /** Matches HeroSlide.id in heroShowcase.ts so the reel can link here. */
  heroSlideId: string;
  /** Eyebrow above the H1. */
  eyebrow: string;
  nightly: NightlyQuote;
  weekly: string;
  /** Occupancy as already published in the homepage rate table. '' when unknown. */
  sleeps: string;
  /** Homepage rate table's "Best For" column, reused verbatim. */
  bestFor: string;
  hero: RoomPhoto;
  gallery: RoomPhoto[];
  /**
   * Shown in place of a gallery when no photograph of the room type exists.
   * Only the $135 Pet-Friendly Room has one.
   */
  galleryNotice?: string;
  /** "About this room" — 2-3 paragraphs, unique to each room. */
  about: string[];
  /** One sentence on what separates this room from the other four. */
  difference: string;
  features: RoomFeature[];
  /** Extra fine print under the price (the pet fee). */
  footnote?: string;
  seo: {
    title: string;
    description: string;
    /** Schema.org bed type, only where a photograph shows it. */
    bedType?: string;
    /** Occupancy as a number, only where the site already publishes one. */
    occupancy?: number;
  };
};

/** Canonical URL for a room page. */
export function roomUrl(slug: string): string {
  return `${BUSINESS.site.domain}/rooms/${slug}`;
}

/** Root-relative href, for links from other pages. */
export function roomHref(slug: string): string {
  return `/rooms/${slug}`;
}

// ── The property-standard bathroom ───────────────────────────────────────────
// One bathroom, photographed once, filed under two or three room folders. The
// hotel confirms the standard rooms share this bathroom, so the same frame is
// reused across their galleries — captioned as the bathroom, never as something
// unique to a room. It is NEVER used on the accessible page: that room has its
// own bathroom and its own photographs.
const BATH_VANITY = (dir: string, file: string): RoomPhoto => ({
  src: `images/${dir}/${file}`,
  caption:
    'The vanity: granite counter with a single basin and a backlit mirror, with towels and a hair dryer on the wall alongside. This is the standard bathroom shared by our non-accessible rooms.',
  alt: 'Hotel bathroom vanity with granite counter and backlit mirror — Best Western Vernal Inn, Vernal Utah',
  shared: true,
});

const BATH_TUB = (dir: string, file: string): RoomPhoto => ({
  src: `images/${dir}/${file}`,
  caption:
    'The bath: a full-size tub and shower combination with a curved curtain rod and chrome fixtures.',
  alt: 'Bathtub and shower combination in a guest bathroom — Best Western Vernal Inn, Vernal Utah',
  shared: true,
});

// ── The shared kitchenette ───────────────────────────────────────────────────
// The hotel confirms the rooms carry the same or a similar kitchenette:
// refrigerator, cooking stove and cabinets. Only what is visible in the frame is
// described — no appliance is named that cannot be seen. Reused across the
// standard rooms and flagged `shared` so no page implies it is unique to it.
const KITCHENETTE = (dir: string, file: string): RoomPhoto => ({
  src: `images/${dir}/${file}`,
  caption:
    'The kitchenette — the same configuration across our rooms: a cooking stove and a single-basin sink set into the counter, cabinets above and below, and a full-height refrigerator with a freezer alongside, on tiled flooring. A microwave and a coffee maker are in frame here too.',
  alt: 'Kitchenette with cooktop, sink, cabinets and full-height refrigerator — Best Western Vernal Inn, Vernal Utah',
  shared: true,
});

export const ROOMS: Room[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'studio-king',
    name: 'Studio King',
    shortName: 'Studio King',
    heroSlideId: 'studio-king',
    eyebrow: 'One King Bed · Studio Layout',
    nightly: nightlyQuote(RATES.nightly.studioKing),
    weekly: WEEKLY_CALL_LINE,
    sleeps: 'Sleeps 1–2',
    bestFor: 'Business travelers, couples',
    hero: {
      src: 'images/King-Studio/King-Studio.jpeg',
      caption:
        'The king bed, centred on the navy accent wall between two nightstands.',
      alt: 'Studio King room with king bed and reading lights — Best Western Vernal Inn, Vernal Utah',
    },
    // The King-Studio folder holds six files: the room shot and five views of
    // the bathroom. Two of those five were cut as redundant — Bathroom-Mirrow
    // (the vanity again, but as a reflection) and Bathtub (a tighter, flatter
    // version of bathtub1). The shared kitchenette is added from the
    // Double-Queen-Studio folder: the hotel confirms the configuration is the
    // same across rooms, and the King-Studio folder simply has no kitchen frame.
    gallery: [
      {
        src: 'images/King-Studio/King-Studio.jpeg',
        caption:
          'The king bed on a light-wood platform frame, with a tall panelled headboard, a wall-mounted reading light on each side and a nightstand either end. Framed Utah landscape prints hang on the flanking walls; the floor is patterned carpet.',
        alt: 'King bed with panelled headboard and wall reading lights in a Studio King room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      KITCHENETTE('Double-Queen-Studio', 'Double-Queen-Kitchenette.jpeg'),
      {
        src: 'images/King-Studio/King-Studio-Bathroom.jpeg',
        caption:
          'The bathroom looking in from the door: tub and shower on the left, toilet, towel rack and shelf, and the granite vanity along the right-hand wall. Tiled floor throughout.',
        alt: 'Guest bathroom with tub, toilet and granite vanity — Best Western Vernal Inn, Vernal Utah',
        shared: true,
      },
      BATH_VANITY('King-Studio', 'King-Studio-Bathroom-Sink.jpeg'),
      {
        src: 'images/King-Studio/King-Studio-bathtub1.jpeg',
        caption:
          'The tub and shower from the doorway, with the curtain drawn back and a towel on the rim.',
        alt: 'Tub and shower seen from the bathroom doorway — Best Western Vernal Inn, Vernal Utah',
        shared: true,
      },
    ],
    about: [
      'The Studio King is our one-king-bed studio, and at $108 a night it shares the lowest published rate on the property with the Handicap / Accessible Studio King. The bed sits on a light-wood platform frame against a navy accent wall, with a wall-mounted reading light and a nightstand on each side — so two people can read, charge a phone and answer the room phone without reaching across each other.',
      'Like our other rooms it has a kitchenette, and it is the same configuration throughout: a cooking stove, a sink, cabinets and a full-height refrigerator with a freezer. The photograph of it in the gallery was taken in another of our studios — the kitchen fit is identical, and we would rather show you the real thing from the room next door than nothing at all.',
      'The bathroom is the property standard: a granite vanity with a single basin under a backlit mirror, a full-size tub and shower combination behind a curved curtain rod, and a tiled floor. Towels, a towel shelf and a hair dryer are on the wall by the vanity.',
      'Free hot breakfast, free WiFi and free parking come with every stay, and the front desk is staffed around the clock. Staying a week or longer? Weekly rates are quoted by phone — call the front desk and ask.',
    ],
    difference:
      'One king bed instead of two queens, and the lowest published nightly rate on the rate card — $12 a night below the Studio Two Queen.',
    features: [
      { label: 'One king bed', source: 'photo' },
      { label: 'Studio layout', source: 'site' },
      { label: 'Sleeps 1–2', source: 'site' },
      { label: 'Kitchenette — cooking stove, sink and cabinets', source: 'site' },
      { label: 'Full-height refrigerator with freezer', source: 'site' },
      { label: 'Wall-mounted reading lights and two nightstands', source: 'photo' },
      { label: 'Tub and shower combination', source: 'photo' },
      { label: 'Granite vanity with backlit mirror', source: 'photo' },
      { label: 'Hair dryer', source: 'photo' },
      { label: 'Carpeted floor', source: 'photo' },
      { label: 'Free WiFi', source: 'site' },
      { label: 'Free hot breakfast', source: 'site' },
      { label: 'Free parking', source: 'site' },
      { label: '24-hour front desk', source: 'site' },
    ],
    seo: {
      title:
        'Studio King Room — $108/Night | Best Western Vernal Inn, Vernal Utah',
      description:
        'Studio King at Best Western Vernal Inn: one king bed, kitchenette, tub and shower, free hot breakfast and free WiFi. $108 per night + tax. Weekly rates — call for price. Call (435) 789-6625.',
      bedType: 'King',
      occupancy: 2,
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'studio-two-queen',
    name: 'Studio Two Queen',
    shortName: 'Studio Two Queen',
    heroSlideId: 'studio-two-queen',
    eyebrow: 'Two Queen Beds · Kitchenette · Studio Layout',
    nightly: nightlyQuote(RATES.nightly.studioTwoQueen),
    weekly: WEEKLY_CALL_LINE,
    sleeps: 'Sleeps 1–4',
    bestFor: 'Families, road trips',
    // PHOTOGRAPHY (reshot 2026-09-08): every frame below is from the owner's
    // new WebP set, and every one was opened and matched to what it shows
    // rather than to its filename. The old JPEG gallery had eleven subjects;
    // each has a new frame here, plus one new angle (Double-Queen7, the whole
    // studio from the dining end) that the old set never had. The hero slides
    // carry their Phoneview twin. Left out, on purpose: Double-Queen10 and its
    // "(2)" copy (the beds and the Delicate Arch again — Double-Queen2 already
    // shows that), Double-Queen-labeled (Double-Queen4 with a caption baked
    // into the pixels), Bathroom1 (toilet and tub, covered by Bathroom4) and
    // Bathroom2 (the vanity again, from a flatter angle than Bathroom5).
    hero: {
      src: 'images/Double-Queen-Studio/Double-Queen1.webp',
      portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview1.webp',
      caption:
        'Two queen beds side by side, with the window and heating and cooling unit beyond.',
      alt: 'Studio Two Queen room with two queen beds — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/Double-Queen-Studio/Double-Queen1.webp',
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview1.webp',
        caption:
          'Two queen beds on light-wood platform frames, each with a panelled headboard, sharing a wall light and a nightstand between them. The window carries a roller shade, with a through-wall heating and cooling unit beneath it.',
        alt: 'Two queen beds with a window and through-wall heating and cooling unit — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen2.webp',
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview2.webp',
        caption:
          'The beds from the other side of the room, with a framed Delicate Arch print on the wall.',
        alt: 'Two queen beds with framed Utah landscape artwork — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen7.webp',
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview6.webp',
        caption:
          'The whole studio from the dining table: the desk and wall-mounted TV on the left, the open closet and a framed canyon print, the window with the heating and cooling unit beneath it, and the two queen beds against the navy accent wall.',
        alt: 'Studio Two Queen seen from the dining table, with desk, TV, closet, window and two queen beds — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen5.webp',
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview4.webp',
        caption:
          'The full length of the studio from the bed: the entry door, the kitchenette with its dining table and two chairs, the armchair and ottoman, and the desk with the wall-mounted TV above it.',
        alt: 'Full view of a Studio Two Queen showing entrance, kitchenette, seating and desk — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen4.webp',
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview3.webp',
        caption:
          'The working half of the room in one frame — kitchenette, dining table, armchair with ottoman, desk with an office chair, and the open closet with its hanging rail, drawers, iron and ironing board.',
        alt: 'Kitchenette, dining table, seating area, desk and closet in a Studio Two Queen — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen9.webp',
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview.webp',
        caption:
          'The seating corner: an upholstered armchair with a matching ottoman under a floor lamp, next to the desk and the wall-mounted TV.',
        alt: 'Armchair, ottoman, floor lamp and wall-mounted TV in a guest room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen6.webp',
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview5.webp',
        caption:
          'The dining table and two upholstered chairs, with the full-height refrigerator and freezer beside them and tiled flooring underfoot at the kitchenette end, looking across to the desk, the closet and the beds.',
        alt: 'Dining table and full-height refrigerator in a studio room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        // The owner shot the kitchenette in portrait only. The gallery tile
        // crops it to its middle band (cooktop, sink, refrigerator) and the
        // lightbox shows the whole frame.
        src: 'images/Double-Queen-Studio/Double-Queen-Kitchenette-Phoneview.webp',
        caption:
          'The kitchenette: a two-burner cooktop and a stainless single-basin sink set into the granite counter, cabinets above and below, a microwave and a coffee maker, and a full-height refrigerator with a freezer opposite, on tiled flooring.',
        alt: 'Kitchenette with two-burner cooktop, sink, microwave, coffee maker and full-height refrigerator — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen8.webp',
        caption:
          'The open closet beside the window: a hanging rail with wooden hangers, an iron on the shelf above, an ironing board stowed alongside and two drawers below. The heating and cooling unit sits under the window, with a framed city-skyline print on the wall by the armchair.',
        alt: 'Open closet with hangers, iron and ironing board next to a window in a Studio Two Queen — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen-Bathroom4.webp',
        caption:
          'The bathroom: the granite vanity ledge on the left, the toilet, towel racks and a towel shelf, and the tub at the far right. This is the standard bathroom shared by our non-accessible rooms.',
        alt: 'Guest bathroom with vanity, toilet and towel racks — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen-Bathroom5.webp',
        caption:
          'The vanity: granite counter with a single basin and a backlit mirror, with towels and a hair dryer on the wall alongside. This is the standard bathroom shared by our non-accessible rooms.',
        alt: 'Hotel bathroom vanity with granite counter and backlit mirror — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Double-Queen-Studio/Double-Queen-Bathroom3.webp',
        caption:
          'The bath: a full-size tub and shower combination with a curved curtain rod and chrome fixtures.',
        alt: 'Bathtub and shower combination in a guest bathroom — Best Western Vernal Inn, Vernal Utah',
      },
    ],
    about: [
      'The Studio Two Queen is the room to book when there are more than two of you. Two queen beds sit side by side on light-wood platform frames, sharing a wall light and a nightstand, and the homepage rate table lists it as sleeping one to four. It is a studio, so the beds, the kitchenette, the seating and the work area are all one open space rather than separate rooms.',
      'The kitchenette is a real one: a two-burner cooktop and a sink set into the counter, an over-range microwave, upper cabinets, a coffee maker and a full-height refrigerator with a freezer. A dining table with two upholstered chairs sits beside it, on tiled flooring that runs under the kitchen end of the room. Along the far wall there is a desk with an office chair and a wall-mounted TV, an armchair with a matching ottoman under a floor lamp, and an open closet with a hanging rail, drawers, a shelf, an iron and ironing board, and a folding luggage rack.',
      'The bathroom is the property standard — granite vanity, backlit mirror, tub and shower combination, tiled floor. Free hot breakfast, free WiFi and free parking are included, and the front desk is staffed 24 hours. Weekly rates for this room are quoted by phone.',
    ],
    difference:
      'Two queen beds rather than one king, and the fullest set of living space we have photographed — dining table, seating area, desk and kitchenette all in the same open studio.',
    features: [
      { label: 'Two queen beds', source: 'photo' },
      { label: 'Sleeps 1–4', source: 'site' },
      { label: 'Kitchenette — two-burner cooktop, sink, microwave, coffee maker', source: 'photo' },
      { label: 'Full-height refrigerator with freezer', source: 'photo' },
      { label: 'Dining table with two chairs', source: 'photo' },
      { label: 'Desk with office chair', source: 'photo' },
      { label: 'Armchair with ottoman and floor lamp', source: 'photo' },
      { label: 'Wall-mounted flat-screen TV', source: 'photo' },
      { label: 'Open closet with hanging rail and drawers', source: 'photo' },
      { label: 'Iron, ironing board and luggage rack', source: 'photo' },
      { label: 'In-room heating and cooling unit', source: 'photo' },
      { label: 'Tub and shower combination', source: 'photo' },
      { label: 'Granite vanity with backlit mirror', source: 'photo' },
      { label: 'Carpeted floor, tiled at the kitchenette', source: 'photo' },
      { label: 'Free WiFi', source: 'site' },
      { label: 'Free hot breakfast', source: 'site' },
      { label: 'Free parking', source: 'site' },
      { label: '24-hour front desk', source: 'site' },
    ],
    seo: {
      title:
        'Studio Two Queen Room — $120/Night | Best Western Vernal Inn, Vernal Utah',
      description:
        'Double queen room in Vernal, Utah: two queen beds, full kitchenette, dining table, desk and free hot breakfast. Sleeps 1–4. $120 per night + tax. Weekly rates — call for price.',
      bedType: 'Queen',
      occupancy: 4,
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'accessible-studio-king',
    name: 'Handicap / Accessible Studio King',
    shortName: 'Accessible Studio King',
    heroSlideId: 'accessible-studio-king',
    eyebrow: 'Accessible · One King Bed · Roll-In Shower',
    nightly: nightlyQuote(RATES.nightly.accessibleStudioKing),
    weekly: WEEKLY_CALL_LINE,
    sleeps: 'Sleeps 1–2',
    bestFor: 'Guests needing ADA access',
    hero: {
      src: 'images/Handicapped-Studio/Handicapped7.jpeg',
      caption:
        'The king bed with clear floor space along both sides.',
      alt: 'Accessible Studio King room with king bed and wide clear floor space — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/Handicapped-Studio/Handicapped7.jpeg',
        caption:
          'The king bed on a low platform frame, with wall-mounted reading lights, nightstands either side and open carpeted floor running the length of the bed.',
        alt: 'King bed with clear floor space in an accessible hotel room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Handicapped-Studio/Handicapped-shower.jpeg',
        caption:
          'The roll-in shower: a low-threshold shower pan with a textured non-slip floor, an angled grab bar along two walls and a fold-down teak seat.',
        alt: 'Roll-in shower with grab bar and fold-down seat — accessible room, Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicapped-Studio/Handicapped-shower1.jpeg',
        caption:
          'The same shower from the doorway, showing the handheld sprayer on its slide bar and the single-lever mixer within reach of the seat.',
        alt: 'Accessible shower with handheld sprayer, slide bar and fold-down seat — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicapped-Studio/Handicapped-bathroom.jpeg',
        caption:
          'The vanity is open underneath — a roll-under counter with no cabinet below it and insulated pipework — under a backlit mirror, with a grab bar on the wall behind the toilet.',
        alt: 'Roll-under bathroom vanity and grab bar in an accessible hotel bathroom — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicapped-Studio/Handicapped-bathroom2.jpeg',
        caption:
          'The accessible bathroom in full: grab bars on two walls by the toilet with the paper holder set below the side bar, a towel shelf within reach, and open floor space between the vanity, the toilet and the shower.',
        alt: 'Accessible hotel bathroom with grab bars and open floor space between fixtures — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicapped-Studio/Handicapped4.jpeg',
        caption:
          'The king bed from the other side of the room, with the roller-shaded window and the heating and cooling unit beneath it.',
        alt: 'King bed beside a shaded window and heating and cooling unit — Best Western Vernal Inn, Vernal Utah',
        shared: true,
        heroSlide: true,
      },
      {
        src: 'images/Handicapped-Studio/Handicapped5.jpeg',
        caption:
          'The studio in one frame from the bed: the kitchenette at the far end, the desk with the wall-mounted TV, and the closet with an ironing board stowed in it.',
        alt: 'Studio room showing kitchenette, desk, TV and closet — Best Western Vernal Inn, Vernal Utah',
        shared: true,
        heroSlide: true,
      },
      KITCHENETTE('Handicapped-Studio', 'Handicapped-Kitchenette.jpeg'),
      {
        src: 'images/Handicapped-Studio/Handicapped3.jpeg',
        caption:
          'The desk and work area with an office chair and the wall-mounted TV, and the armchair and ottoman across the corner.',
        alt: 'Desk, office chair, TV and armchair in a guest room — Best Western Vernal Inn, Vernal Utah',
        shared: true,
        heroSlide: true,
      },
      {
        src: 'images/Handicapped-Studio/Handicapped6.jpeg',
        caption:
          'The open closet: full-width hanging rail with hangers, drawers below, a shelf above and a folding luggage rack stowed beside it.',
        alt: 'Open closet with hanging rail, drawers and luggage rack — Best Western Vernal Inn, Vernal Utah',
        shared: true,
      },
    ],
    about: [
      'The Handicap / Accessible Studio King is a one-king-bed studio built around the bathroom. It is priced at $108 a night — the same as the standard Studio King, not a premium — and the accessibility features are real fixtures, not a designation on a booking sheet.',
      'The shower is a roll-in: a low-threshold pan with a textured non-slip floor, an angled grab bar running along two walls, a fold-down teak seat, and a handheld sprayer on a slide bar with a single-lever mixer set within reach of the seat. The vanity is a roll-under counter — open underneath with no cabinet below and insulated pipework — under a backlit mirror. There are grab bars on both walls beside the toilet, with the paper holder set below the side bar, and open floor space between the vanity, the toilet and the shower.',
      'The bedroom itself is the same studio the rest of the property uses: king bed on a low platform frame with reading lights and nightstands, a kitchenette with a cooktop, sink, microwave, coffee maker and full-height refrigerator, a desk with a wall-mounted TV, an armchair and ottoman, and an open closet with a hanging rail, drawers, an iron and ironing board. There is clear carpeted floor along both sides of the bed. Free hot breakfast, free WiFi, free parking and a 24-hour front desk are included.',
      'If you have a specific access requirement — bed height, doorway width, or where in the building the room sits — call the front desk before you book. Rather than publish a measurement we have not verified, we would rather someone check it for you.',
    ],
    difference:
      'The only room type with a roll-in shower, a fold-down shower seat, a roll-under vanity and grab bars — at the same $108 nightly rate as the standard Studio King.',
    features: [
      { label: 'One king bed', source: 'photo' },
      { label: 'Sleeps 1–2', source: 'site' },
      { label: 'Roll-in shower with low threshold and non-slip floor', source: 'photo' },
      { label: 'Fold-down shower seat', source: 'photo' },
      { label: 'Handheld sprayer on a slide bar', source: 'photo' },
      { label: 'Grab bars in the shower and beside the toilet', source: 'photo' },
      { label: 'Roll-under vanity with open space beneath', source: 'photo' },
      { label: 'Open floor space between the bathroom fixtures', source: 'photo' },
      { label: 'Clear floor space along both sides of the bed', source: 'photo' },
      { label: 'Kitchenette — cooktop, sink, microwave, coffee maker', source: 'photo' },
      { label: 'Full-height refrigerator with freezer', source: 'photo' },
      { label: 'Desk with office chair and wall-mounted TV', source: 'photo' },
      { label: 'Armchair with ottoman', source: 'photo' },
      { label: 'Open closet with hanging rail, drawers, iron and ironing board', source: 'photo' },
      { label: 'In-room heating and cooling unit', source: 'photo' },
      { label: 'Free WiFi', source: 'site' },
      { label: 'Free hot breakfast', source: 'site' },
      { label: 'Free parking', source: 'site' },
      { label: '24-hour front desk', source: 'site' },
    ],
    seo: {
      title:
        'Accessible Studio King — Roll-In Shower, $108/Night | Best Western Vernal Inn',
      description:
        'Accessible hotel room in Vernal, Utah: king bed, roll-in shower with fold-down seat, grab bars and a roll-under vanity. $108 per night + tax — the same rate as our standard Studio King. Weekly rates — call for price.',
      bedType: 'King',
      occupancy: 2,
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'pet-friendly-studio-two-queen',
    name: 'Pet-Friendly Studio Two Queen',
    shortName: 'Pet-Friendly Studio Two Queen',
    heroSlideId: 'pet-friendly-studio-two-queen',
    eyebrow: 'Dogs Welcome · Two Queen Beds · Wood-Style Floors',
    nightly: nightlyQuote(RATES.nightly.petFriendlyStudioTwoQueen),
    weekly: WEEKLY_CALL_LINE,
    sleeps: 'Sleeps 1–4',
    bestFor: 'Guests with dogs (up to 80 lbs)',
    footnote: 'Pet fee $30/day + $100 refundable deposit',
    hero: {
      src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen6.jpeg',
      caption:
        'Two queen beds on wood-style plank flooring.',
      alt: 'Pet-friendly Studio Two Queen with two queen beds and wood-style floors — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen6.jpeg',
        caption:
          'Two queen beds on light-wood platform frames with panelled headboards and brown covers, on wood-style plank flooring that runs the width of the room.',
        alt: 'Two queen beds on wood-style plank flooring in a pet-friendly room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen1.jpeg',
        caption:
          'The beds head-on, sharing a wall light and a nightstand with the room phone and an alarm clock on it.',
        alt: 'Two queen beds sharing a nightstand and wall light — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen2.jpeg',
        caption:
          'The beds from the other corner, with the roller-shaded window and the heating and cooling unit beneath it.',
        alt: 'Pet-friendly room with two beds, window and heating and cooling unit — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen.jpeg',
        caption:
          'The full length of the room from beside the beds: the entry door at the far end, the kitchenette, the dining table with two chairs, the desk and the ottoman — all on continuous wood-style plank flooring.',
        alt: 'Full view of a pet-friendly studio showing entrance, kitchenette, dining table and wood-style floors — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen8.jpeg',
        caption:
          'The kitchenette and dining table by the entrance — the same kitchen configuration as our other rooms: a cooktop and sink in the counter, cabinets above and below, and a coffee maker, with a table and upholstered chairs alongside.',
        alt: 'Kitchenette with cooktop, sink and cabinets beside a dining table — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen9.jpeg',
        caption:
          'The dining table and chairs with the full-height refrigerator and freezer beside them, and the armchair, floor lamp and TV beyond.',
        alt: 'Dining table, refrigerator and seating area in a pet-friendly room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen7.jpeg',
        caption:
          'The seating corner: an armchair with a matching ottoman under a floor lamp, next to the desk, office chair and wall-mounted TV.',
        alt: 'Armchair, ottoman and desk with wall-mounted TV on wood-style floors — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen5.jpeg',
        caption:
          'The closet unit, with a full-length mirror on one side — the window and its heating and cooling unit reflected in it — an open hanging bay, two drawers and an ironing board stowed to the right.',
        alt: 'Closet unit with full-length mirror, hanging bay, drawers and ironing board — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen-Bathroom2.jpeg',
        caption:
          'The bathroom from the door: granite vanity on the left, toilet, towel racks and shelf, and the tub beyond. Tiled floor.',
        alt: 'Guest bathroom with vanity, toilet and tub — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen-Bathroom-Sink.jpeg',
        caption:
          'The vanity and backlit mirror, with the tub and shower reflected behind.',
        alt: 'Bathroom vanity and backlit mirror reflecting the shower — Best Western Vernal Inn, Vernal Utah',
      },
      // Bathtub2, not Bathtub: the three tub files in this folder are three
      // different frames of the same bath, and Bathtub2 is the strongest —
      // curtain drawn back, towel shelf and toilet in frame for scale.
      BATH_TUB(
        'Pet-Friendly-Double-Queen',
        'PetFriendly-Double-Queen-Bathtub2.jpeg'
      ),
    ],
    about: [
      'This is the room to book when the dog is coming. It is a two-queen studio like the Studio Two Queen, but laid on wood-style plank flooring rather than carpet — which is the whole point of it. Wet paws, shed hair and the occasional accident come off a plank floor in a way they do not come out of carpet, and that is why this room type carries a higher rate than the carpeted equivalent.',
      'The layout is the full studio: two queen beds on light-wood platform frames sharing a wall light and a nightstand, a kitchenette with a two-burner cooktop, sink, over-range microwave, coffee maker and a full-height refrigerator with freezer, a dining table with upholstered chairs by the entrance, a desk with an office chair and a wall-mounted TV, an armchair with an ottoman, and a closet unit with a full-length mirror, a hanging bay, drawers and an ironing board. The bathroom is the property standard — granite vanity, backlit mirror, tub and shower combination, tiled floor.',
      'The pet policy is the hotel\'s published one: up to two dogs per room, an 80 lb limit per dog, a $30 per day pet fee and a $100 refundable damage deposit taken at check-in. Other pets may be approved with prior notice — call the front desk. Free hot breakfast, free WiFi, free parking and a 24-hour front desk come with the room.',
    ],
    difference:
      'The only two-queen room we have photographed on wood-style plank flooring instead of carpet — chosen for dogs, and priced accordingly at $155.',
    features: [
      { label: 'Dogs welcome — up to two per room, 80 lb limit each', source: 'site' },
      { label: 'Pet fee $30/day + $100 refundable deposit', source: 'site' },
      { label: 'Two queen beds', source: 'photo' },
      { label: 'Sleeps 1–4', source: 'site' },
      { label: 'Wood-style plank flooring throughout', source: 'photo' },
      { label: 'Kitchenette — two-burner cooktop, sink, microwave, coffee maker', source: 'photo' },
      { label: 'Full-height refrigerator with freezer', source: 'photo' },
      { label: 'Dining table with upholstered chairs', source: 'photo' },
      { label: 'Desk with office chair and desk lamp', source: 'photo' },
      { label: 'Wall-mounted flat-screen TV', source: 'photo' },
      { label: 'Armchair with ottoman and floor lamp', source: 'photo' },
      { label: 'Closet with full-length mirror, hanging bay and drawers', source: 'photo' },
      { label: 'Ironing board', source: 'photo' },
      { label: 'In-room heating and cooling unit', source: 'photo' },
      { label: 'Tub and shower combination', source: 'photo' },
      { label: 'Granite vanity with backlit mirror', source: 'photo' },
      { label: 'Free WiFi', source: 'site' },
      { label: 'Free hot breakfast', source: 'site' },
      { label: 'Free parking', source: 'site' },
      { label: '24-hour front desk', source: 'site' },
    ],
    seo: {
      title:
        'Pet-Friendly Studio Two Queen — $155/Night | Best Western Vernal Inn, Vernal Utah',
      description:
        'Pet-friendly hotel room in Vernal, Utah: two queen beds, wood-style floors, full kitchenette. Up to two dogs, 80 lb limit, $30/day pet fee. $155 per night + tax. Weekly rates — call for price.',
      bedType: 'Queen',
      occupancy: 4,
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'pet-friendly-room',
    name: 'Pet-Friendly Room',
    shortName: 'Pet-Friendly Room',
    heroSlideId: 'pet-friendly-room',
    eyebrow: 'Dogs Welcome · Ground Floor',
    nightly: nightlyQuote(RATES.nightly.petFriendlyRoom),
    weekly: WEEKLY_CALL_LINE,
    // The homepage rate table publishes no occupancy for this room type — the
    // "Sleeps" cell is an em dash. Do not invent one here.
    sleeps: '',
    bestFor: 'Guests with dogs (up to 80 lbs)',
    footnote: 'Pet fee $30/day + $100 refundable deposit',
    // ⚠️ STAND-IN RENDER, NOT A PHOTOGRAPH. Same image the homepage hero reel
    // uses: a crop of 53.webp. Re-checked 2026-09-03 — 53.webp is CGI, and the
    // caption baked into it reads "Standard KING — Pet Friendly", so it depicts
    // a KING configuration. The rate card's "Pet-Friendly Room" has no
    // confirmed bed type, which is exactly why none is claimed on this page and
    // why the caption below calls the picture what it is.
    //
    // It must NOT be swapped for anything from
    // public/images/Pet-Friendly-Double-Queen/ — every file in that folder is
    // the Pet-Friendly Studio Two Queen, a different room at a different price
    // ($155). See the note at the top of heroShowcase.ts.
    hero: {
      src: 'images/rooms/pet-friendly-room.webp',
      caption:
        'This is an illustration of a pet-friendly room, not a photograph of this one — see below.',
      alt: 'Illustration of a pet-friendly room with kitchenette and wood-style floors — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [],
    galleryNotice:
      'We have not photographed this room type yet, and we would rather show you nothing than show you a different room. The picture at the top of this page is a computer-generated illustration, not a photograph of this room — every photograph on our other room pages is of that room specifically. If you would like to see this one before you book, call the front desk on (435) 789-6625 and ask: they can tell you exactly what is in it and, if you are already in Vernal, show you.',
    about: [
      'The Pet-Friendly Room is the second of our two dog-friendly room types, at $135 a night. It sits between the Studio Two Queen and the Pet-Friendly Studio Two Queen on the rate card.',
      'What the site can confirm about it: dogs are welcome, it has wood-style floors, and ground-floor pet rooms are available so you can take a dog straight outside without stairs or an elevator. The pet policy is the hotel\'s published one — up to two dogs per room, an 80 lb limit per dog, a $30 per day pet fee and a $100 refundable damage deposit at check-in. Free hot breakfast, free WiFi, free parking and a 24-hour front desk come with the room.',
      'What the site will not do is guess at the rest. The bed configuration, the occupancy and the in-room appliances for this room type have not been confirmed by the hotel, so they are not listed below. Call the front desk and they will tell you exactly what is in it.',
    ],
    difference:
      'The lower-priced of our two dog-friendly room types at $135, with wood-style floors and ground-floor access.',
    features: [
      { label: 'Dogs welcome — up to two per room, 80 lb limit each', source: 'site' },
      { label: 'Pet fee $30/day + $100 refundable deposit', source: 'site' },
      { label: 'Wood-style floors', source: 'site' },
      { label: 'Ground-floor pet rooms available', source: 'site' },
      { label: 'Free WiFi', source: 'site' },
      { label: 'Free hot breakfast', source: 'site' },
      { label: 'Free parking', source: 'site' },
      { label: '24-hour front desk', source: 'site' },
    ],
    seo: {
      title:
        'Pet-Friendly Room — $135/Night | Best Western Vernal Inn, Vernal Utah',
      description:
        'Pet-friendly room in Vernal, Utah with wood-style floors and ground-floor access. Up to two dogs, 80 lb limit, $30/day pet fee. $135 per night + tax. Weekly rates — call for price.',
    },
  },
];

/** Look up a room by the hero-reel slide id, so the reel can link to its page. */
export function roomBySlideId(slideId: string): Room | undefined {
  return ROOMS.find((r) => r.heroSlideId === slideId);
}

/** Every room except the one given — the "Looking for a different room?" list. */
export function otherRooms(slug: string): Room[] {
  return ROOMS.filter((r) => r.slug !== slug);
}
