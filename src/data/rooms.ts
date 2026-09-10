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
// A photograph counts as evidence of a room when the folder and what is
// visible in the frame agree. Where a file is shared between folders, it is
// marked `shared: true` and captioned for what it is (the standard bathroom)
// rather than sold as a room-specific feature.
//
// RESHOOT, ROOM BY ROOM (2026-09-08 to 2026-09-09)
//
// The owner re-photographed each room and delivered WebP straight into its
// folder, in pairs: a 1672×941 landscape frame and a 941×1672 "Phoneview" twin
// of the same angle for the phone hero. The numbers in the two series do NOT
// line up; every twin below was matched by opening both files. All four
// photographed room types are now on the new sets, and every old JPEG is gone:
//
//   • public/images/Double-Queen-Studio/      Studio Two Queen
//   • public/images/Handicaped-Studio/        Accessible Studio King (one "p" —
//                                             the folder name as supplied)
//   • public/images/King-Studio/              Studio King
//   • public/images/Pet-Friendly-Double-Queen/ Pet-Friendly Studio Two Queen
//
// THE STANDARD BATHROOM. The new bathroom set (Bathroom1–5 and their five
// Phoneviews) is byte-for-byte identical under King-Studio, Double-Queen-Studio
// and Pet-Friendly-Double-Queen: one property-standard bathroom, photographed
// once, filed three times. Each of those pages shows it from its own folder,
// flagged `shared` and captioned as the shared bathroom. It is never used on
// the accessible page, which has its own bathroom and its own photographs.
//
// EVERY Phoneview IS FOR A PHONE SCREEN, not just the hero's. A frame's
// `portrait` twin is read in two places: the hero slideshow (flagged frames
// only) and the gallery lightbox, which on a phone held upright would
// otherwise letterbox a 16:9 frame to about a third of the screen. So a
// gallery-only subject — a bathroom, a kitchenette, a closet — carries its
// twin too, even though it will never be a hero slide. The tiles stay
// landscape: a tile is a 1.27:1 box and a 9:16 file survives it only as a
// narrow middle band.
//
// What each folder still holds unused: the frames with a price or a room name
// baked into the pixels ("-$108", "-Labeled"), and the twins of landscape
// frames that were themselves cut as near-duplicates. Left in place,
// untracked, and not referenced.
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
   * slideshow, which on a phone held upright is a 3:4 stage showing three
   * quarters of this frame's height (rooms.css). A frame without one simply
   * shows its landscape image at every width. The gallery tiles and the
   * lightbox never read it — they are landscape at every size.
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
   * A room with fewer than two flagged frames simply shows a still hero. Since
   * the reshoot every photographed room has six or more.
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
// One bathroom, photographed once, filed byte-for-byte under three room
// folders (see the header). The hotel confirms the standard rooms share this
// bathroom, so the same three frames are reused across their galleries —
// captioned as the bathroom, never as something unique to a room. Each page
// reads them from its own folder so a folder can be cleared independently.
// NEVER used on the accessible page: that room has its own bathroom and its
// own photographs.
//
// Each frame carries its 9:16 Phoneview twin, matched by content — the numbers
// do NOT correspond (Bathroom4 ↔ Phoneview3, Bathroom5 ↔ Phoneview4,
// Bathroom3 ↔ Phoneview2). Bathrooms are never hero slides, but the lightbox
// serves the portrait on a phone held upright.
const STANDARD_BATHROOM = (dir: string, prefix: string): RoomPhoto[] => [
  {
    src: `images/${dir}/${prefix}-Bathroom4.webp`,
    portrait: `images/${dir}/${prefix}-Bathroom-Phoneview3.webp`,
    caption:
      'The bathroom: the granite vanity ledge on the left, the toilet, towel racks and a towel shelf, and the tub at the far right. This is the standard bathroom shared by our non-accessible rooms.',
    alt: 'Guest bathroom with vanity, toilet and towel racks — Best Western Vernal Inn, Vernal Utah',
    shared: true,
  },
  {
    src: `images/${dir}/${prefix}-Bathroom5.webp`,
    portrait: `images/${dir}/${prefix}-Bathroom-Phoneview4.webp`,
    caption:
      'The vanity: granite counter with a single basin and a backlit mirror, with towels and a hair dryer on the wall alongside. This is the standard bathroom shared by our non-accessible rooms.',
    alt: 'Hotel bathroom vanity with granite counter and backlit mirror — Best Western Vernal Inn, Vernal Utah',
    shared: true,
  },
  {
    src: `images/${dir}/${prefix}-Bathroom3.webp`,
    portrait: `images/${dir}/${prefix}-Bathroom-Phoneview2.webp`,
    caption:
      'The bath: a full-size tub and shower combination with a curved curtain rod and chrome fixtures.',
    alt: 'Bathtub and shower combination in a guest bathroom — Best Western Vernal Inn, Vernal Utah',
    shared: true,
  },
];

export const ROOMS: Room[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'queen-suite',
    name: 'Queen Suite',
    shortName: 'Queen Suite',
    heroSlideId: 'queen-suite',
    eyebrow: 'One Queen Bed · Sofa · Kitchenette',
    nightly: nightlyQuote(RATES.nightly.queenSuite),
    weekly: WEEKLY_CALL_LINE,
    // The homepage rate table has never carried a row for this room, so there
    // is no previously published occupancy to reuse. A queen bed plus a sofa
    // is not evidence that the sofa converts, so nothing is claimed: `sleeps`
    // stays empty until the front desk confirms it, exactly as the $135
    // Pet-Friendly Room does.
    sleeps: '',
    bestFor: 'Couples, solo travelers, longer stays',
    // ADDED 2026-09-09, on the owner's instruction and with the owner's own
    // photography in public/images/Queen-Suite/.
    //
    // THIS ROOM WAS DELIBERATELY ABSENT BEFORE, and the reason is worth
    // keeping: heroShowcase.ts carried the note "a plain Queen slide used to
    // sit between King and Double Queen; the rate card has no such room, which
    // also matches the asset set (it was the one slide with no real photograph
    // behind it). Do not add it back to make the count even." Both conditions
    // have now changed — the owner supplied a full photographic set AND named
    // the rate — so the instruction is satisfied rather than overridden. It
    // was never "no Queen room exists"; it was "do not invent one".
    //
    // The name and the rate are the hotel's own: the folder ships a labelled
    // frame reading "Queen Suite" and another with a "$95/night" badge.
    //
    // The bathroom is the property standard, byte-for-byte identical to the
    // King, Two Queen and Pet-Friendly copies, so it comes from the shared
    // helper and is flagged `shared` like the others.
    //
    // The ten room Phoneviews were delivered as ~2.5 MB PNGs, the only room
    // folder that was not WebP; they were converted at quality 82 and land at
    // 134-287 KB, the same band as every other room's twins. In this set the
    // landscape and Phoneview numbers DO correspond. Left out, on purpose:
    // Queen-Suite2 and Queen-Suite3 (the bed again, between the angles kept in
    // Queen-Suite1 and Queen-Suite9), Queen-Suite8 (the desk and closet again,
    // covered by Queen-Suite6 and Queen-Suite4) and the two "-Labeled" files.
    hero: {
      src: 'images/Queen-Suite/Queen-Suite.webp',
      portrait: 'images/Queen-Suite/Queen-Suite-phoneview.webp',
      caption: 'The queen bed with the sofa and the window beyond.',
      alt: 'Queen Suite with a queen bed and a sofa — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/Queen-Suite/Queen-Suite.webp',
        portrait: 'images/Queen-Suite/Queen-Suite-phoneview.webp',
        caption:
          'The queen bed on a light-wood platform frame against the navy accent wall, with a wall-mounted reading light and a nightstand either side. Beyond it a two-seat sofa sits under the window with a floor lamp beside it, and a framed print of the Flaming Gorge bridge hangs on the far wall.',
        alt: 'Queen bed with a two-seat sofa under the window — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Queen-Suite/Queen-Suite1.webp',
        portrait: 'images/Queen-Suite/Queen-Suite-phoneview1.webp',
        caption:
          'The bed head-on, with a panelled headboard, a wall light and a nightstand on each side, the room phone and clock within reach, and a framed waterfall print on the wall to the left.',
        alt: 'Queen bed with panelled headboard and wall reading lights — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Queen-Suite/Queen-Suite9.webp',
        portrait: 'images/Queen-Suite/Queen-Suite-phoneview9.webp',
        caption:
          'The bed from the window side, with the roller-shaded window looking out over Vernal, the heating and cooling unit beneath it and a framed Delicate Arch print on the accent wall.',
        alt: 'Queen bed beside a shaded window and heating and cooling unit — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Queen-Suite/Queen-Suite5.webp',
        portrait: 'images/Queen-Suite/Queen-Suite-phoneview5.webp',
        caption:
          'The entrance end: the kitchenette with a sink in the counter, cabinets above and below, a microwave and a coffee maker, and a dining table with two upholstered chairs beside the door.',
        alt: 'Kitchenette with microwave and coffee maker beside a dining table and entry door — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Queen-Suite/Queen-Suite6.webp',
        portrait: 'images/Queen-Suite/Queen-Suite-phoneview6.webp',
        caption:
          'The working half of the room: a desk with an office chair and a reading lamp under the wall-mounted TV, the open closet beside it, and the window with the heating and cooling unit beneath it.',
        alt: 'Desk, office chair, wall-mounted TV and open closet beside a window — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Queen-Suite/Queen-Suite4.webp',
        portrait: 'images/Queen-Suite/Queen-Suite-phoneview4.webp',
        caption:
          'The closet in full: a hanging rail with wooden hangers, an iron and an ironing board stowed alongside, open shelving and two drawers below, next to the desk and the wall-mounted TV.',
        alt: 'Open closet with hangers, iron and ironing board beside a desk — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Queen-Suite/Queen-Suite7.webp',
        portrait: 'images/Queen-Suite/Queen-Suite-phoneview7.webp',
        caption:
          'The kitchenette: a stainless single-basin sink and a two-burner cooktop set into the granite counter, a microwave and a coffee maker above, and a full-height refrigerator with a freezer alongside, on tiled flooring.',
        alt: 'Kitchenette with sink, two-burner cooktop, microwave and full-height refrigerator — Best Western Vernal Inn, Vernal Utah',
      },
      ...STANDARD_BATHROOM('Queen-Suite', 'Queen'),
    ],
    about: [
      'The Queen Suite is the lowest published rate on our card at $95 a night — below both of our $108 studios — and it is the room to book when there are two of you and you would rather spend the difference on the rest of the trip.',
      'One queen bed sits on a light-wood platform frame against the navy accent wall, with a wall-mounted reading light and a nightstand on each side. What separates this room from the studios is the sofa: a two-seat sofa under the window with a floor lamp beside it, so there is somewhere to sit that is not the bed or the desk chair.',
      'It has the same kitchenette as the rest of the property — a sink and a two-burner cooktop in the counter, cabinets, a microwave, a coffee maker and a full-height refrigerator with a freezer — with a dining table and two upholstered chairs by the entrance. There is a desk with an office chair under a wall-mounted TV, and an open closet with a hanging rail, an iron and an ironing board. The bathroom is the property standard: a granite vanity with a backlit mirror, a full-size tub and shower combination, and a tiled floor.',
      'Free hot breakfast, free WiFi and free parking come with every stay, and the front desk is staffed around the clock. How many people this room sleeps is the one thing we have not had confirmed, so we do not publish it — call the front desk and ask. Weekly rates are quoted by phone.',
    ],
    difference:
      'The lowest published nightly rate we have at $95, and the only room we have photographed with a sofa in it.',
    features: [
      { label: 'One queen bed', source: 'photo' },
      { label: 'Two-seat sofa with floor lamp', source: 'photo' },
      { label: 'Kitchenette — two-burner cooktop, sink, microwave, coffee maker', source: 'photo' },
      { label: 'Full-height refrigerator with freezer', source: 'photo' },
      { label: 'Dining table with two chairs', source: 'photo' },
      { label: 'Desk with office chair', source: 'photo' },
      { label: 'Wall-mounted flat-screen TV', source: 'photo' },
      { label: 'Open closet with hanging rail, iron and ironing board', source: 'photo' },
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
      title: 'Queen Suite — $95/Night | Best Western Vernal Inn, Vernal Utah',
      description:
        'Queen Suite at Best Western Vernal Inn: one queen bed, a sofa, a full kitchenette, free hot breakfast and free WiFi. $95 per night + tax — our lowest published rate. Weekly rates — call for price.',
      bedType: 'Queen',
    },
  },

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
    // PHOTOGRAPHY (reshot 2026-09-09): the owner's new WebP set in
    // public/images/King-Studio/. Every frame was opened and matched by what
    // it shows. The old gallery had one room photograph and borrowed its
    // kitchenette from the Two Queen folder; this room now has ten of its own
    // room frames and its own kitchenette. In this set the landscape and
    // Phoneview numbers DO line up (King-Studio4 ↔ phoneview4, and so on). Two
    // Studio Kings were photographed — one hung with a Delicate Arch print,
    // one with a waterfall and a Bixby Bridge print — and both are the same
    // room type on the same carpet, so both appear. Left out, on purpose:
    // King-Studio1 and King-Studio11 (the bed head-on again — King-Studio
    // already shows that), King-Studio9 (the bed from the door, covered by
    // King-Studio5 and King-Studio10), King-Studio7 (the closet and desk,
    // covered by King-Studio8 with the kitchenette in frame), King-Studio2
    // (the closet beside the window, visible in King-Studio8 and 3),
    // "King-Studio-$108" (King-Studio8 with a caption baked into the pixels),
    // and Bathroom1 / Bathroom2 (the tub and the vanity again, from flatter
    // angles than Bathroom3 and Bathroom5).
    hero: {
      src: 'images/King-Studio/King-Studio.webp',
      portrait: 'images/King-Studio/King-Studio-phoneview.webp',
      caption:
        'The king bed, centred on the navy accent wall between two nightstands.',
      alt: 'Studio King room with king bed and reading lights — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/King-Studio/King-Studio.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview.webp',
        caption:
          'The king bed on a light-wood platform frame against the navy accent wall, with a tall panelled headboard, a wall-mounted reading light on each side and a nightstand either end. A framed Delicate Arch print hangs on the wall to the right; the floor is patterned carpet.',
        alt: 'King bed with panelled headboard and wall reading lights in a Studio King room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/King-Studio/King-Studio4.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview4.webp',
        caption:
          'The king bed from the window side of the room, with the roller-shaded window and the heating and cooling unit beneath it, and the room phone on the nightstand.',
        alt: 'King bed beside a shaded window and heating and cooling unit — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/King-Studio/King-Studio5.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview5.webp',
        caption:
          'The bed from the entry door, with framed prints of a waterfall and the Bixby Bridge on either side of the headboard and the heating and cooling unit at the far right.',
        alt: 'King bed seen from the entry door with framed landscape prints either side — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/King-Studio/King-Studio6.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview6.webp',
        caption:
          'The working half of the studio from the foot of the bed: the desk with an office chair and the wall-mounted TV, the dining table and two chairs, the kitchenette with its microwave and cabinets, and the entry door beyond.',
        alt: 'Studio King showing desk, TV, dining table, kitchenette and entry door — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/King-Studio/King-Studio8.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview8.webp',
        caption:
          'The same half of the room in one frame from beside the bed: the open closet with its hanging rail, drawers and stowed ironing board, the desk and wall-mounted TV, the dining table with two upholstered chairs, and the kitchenette at the far end.',
        alt: 'Open closet, desk, TV, dining table and kitchenette in a Studio King — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/King-Studio/King-Studio3.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview3.webp',
        caption:
          'The desk and work area with an office chair and the wall-mounted TV, an armchair and ottoman under a floor lamp across the corner, and the open closet with hangers and an ironing board beside them.',
        alt: 'Desk, office chair, TV, armchair and open closet in a guest room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/King-Studio/King-Studio10.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview10.webp',
        caption:
          'The dining table and two upholstered chairs beside the bed, with the window and the heating and cooling unit beneath it, and a framed Bixby Bridge print on the wall.',
        alt: 'Dining table and two chairs beside a king bed and window — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/King-Studio/King-Studio12.webp',
        portrait: 'images/King-Studio/King-Studio-phoneview12.webp',
        caption:
          'The kitchenette: a stainless single-basin sink set into the granite counter, cabinets above and below, a microwave and a coffee maker, and a full-height refrigerator with a freezer beside the dining table, on tiled flooring.',
        alt: 'Kitchenette with sink, microwave, coffee maker and full-height refrigerator — Best Western Vernal Inn, Vernal Utah',
      },
      ...STANDARD_BATHROOM('King-Studio', 'King'),
    ],
    about: [
      'The Studio King is our one-king-bed studio, and at $108 a night it shares the lowest published rate on the property with the Handicap / Accessible Studio King. The bed sits on a light-wood platform frame against a navy accent wall, with a wall-mounted reading light and a nightstand on each side — so two people can read, charge a phone and answer the room phone without reaching across each other.',
      'Like our other rooms it has a kitchenette, and it is the same configuration throughout: a cooking stove, a sink, cabinets, a microwave, a coffee maker and a full-height refrigerator with a freezer, with a dining table and two chairs alongside on tiled flooring. Along the far wall there is a desk with an office chair and a wall-mounted TV, an armchair with an ottoman under a floor lamp, and an open closet with a hanging rail, drawers and an ironing board.',
      'The bathroom is the property standard: a granite vanity with a single basin under a backlit mirror, a full-size tub and shower combination behind a curved curtain rod, and a tiled floor. Towels, a towel shelf and a hair dryer are on the wall by the vanity.',
      'Free hot breakfast, free WiFi and free parking come with every stay, and the front desk is staffed around the clock. Staying a week or longer? Weekly rates are quoted by phone — call the front desk and ask.',
    ],
    difference:
      // NOT "the lowest published nightly rate on the rate card" any more: that
      // was written when $108 was the floor, and the $95 Queen Suite added on
      // 2026-09-09 sits below it. Compare against the Studio Two Queen only.
      'One king bed instead of two queens, at $108 a night — $12 below the Studio Two Queen.',
    features: [
      { label: 'One king bed', source: 'photo' },
      { label: 'Studio layout', source: 'site' },
      { label: 'Sleeps 1–2', source: 'site' },
      { label: 'Kitchenette — cooking stove, sink and cabinets', source: 'site' },
      { label: 'Full-height refrigerator with freezer', source: 'site' },
      { label: 'Wall-mounted reading lights and two nightstands', source: 'photo' },
      { label: 'Dining table with two chairs', source: 'photo' },
      { label: 'Desk with office chair and wall-mounted TV', source: 'photo' },
      { label: 'Armchair with ottoman and floor lamp', source: 'photo' },
      { label: 'Open closet with hanging rail, drawers and ironing board', source: 'photo' },
      { label: 'In-room heating and cooling unit', source: 'photo' },
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
        portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview7.webp',
        caption:
          'The open closet beside the window: a hanging rail with wooden hangers, an iron on the shelf above, an ironing board stowed alongside and two drawers below. The heating and cooling unit sits under the window, with a framed city-skyline print on the wall by the armchair.',
        alt: 'Open closet with hangers, iron and ironing board next to a window in a Studio Two Queen — Best Western Vernal Inn, Vernal Utah',
      },
      ...STANDARD_BATHROOM('Double-Queen-Studio', 'Double-Queen'),
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
    // PHOTOGRAPHY (reshot 2026-09-08): the owner's new WebP set, delivered to
    // public/images/Handicaped-Studio/ — one "p", the folder name as supplied.
    // Every frame was opened and matched by what it shows. The old gallery's
    // ten subjects each have a new frame, plus one new angle (studio6, the
    // working half of the room from the foot of the bed). Two files are not
    // what their names say: studio5 is a byte-for-byte copy of studio3, and
    // bathroom-phoneview1 is a LANDSCAPE frame (the shower from the doorway)
    // and is used as one. Left out, on purpose: studio2 and phoneview2 (the
    // desk corner again, tighter than studio / phoneview), studio5 (the
    // duplicate), the two files with a caption baked into the pixels
    // ("$108" and "labeled"), and bathroom-phoneview / bathroom-phoneview2
    // (bathrooms are never hero slides, so their portraits have no use).
    hero: {
      src: 'images/Handicaped-Studio/Handicapped-studio7.webp',
      portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview6.webp',
      caption:
        'The king bed with clear floor space along both sides.',
      alt: 'Accessible Studio King room with king bed and wide clear floor space — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/Handicaped-Studio/Handicapped-studio7.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview6.webp',
        caption:
          'The king bed on a low platform frame against the navy accent wall, with a wall-mounted reading light and a nightstand either side and open carpeted floor running the length of the bed. A framed Delicate Arch print hangs on the wall to the right.',
        alt: 'King bed with clear floor space in an accessible hotel room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio-bathroom2.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-bathroom-phoneview2.webp',
        caption:
          'The roll-in shower: a low-threshold shower pan with a textured non-slip floor, an angled grab bar along two walls and a fold-down teak seat.',
        alt: 'Roll-in shower with grab bar and fold-down seat — accessible room, Best Western Vernal Inn, Vernal Utah',
      },
      {
        // Landscape despite the "phoneview" in its name — see the note above.
        src: 'images/Handicaped-Studio/Handicapped-studio-bathroom-phoneview1.webp',
        caption:
          'The same shower from the doorway, showing the handheld sprayer on its slide bar and the single-lever mixer within reach of the seat, with towels on the shelf outside.',
        alt: 'Accessible shower with handheld sprayer, slide bar and fold-down seat — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio-bathroom.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-bathroom-phoneview.webp',
        caption:
          'The vanity is open underneath — a roll-under counter with no cabinet below it and insulated pipework — under a backlit mirror, with a grab bar on the wall behind the toilet and another on the wall beside it.',
        alt: 'Roll-under bathroom vanity and grab bar in an accessible hotel bathroom — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio-bathroom1.webp',
        caption:
          'The accessible bathroom in full: grab bars on two walls by the toilet with the paper holder set below the side bar, a towel shelf within reach, and open floor space between the vanity, the toilet and the shower.',
        alt: 'Accessible hotel bathroom with grab bars and open floor space between fixtures — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio3.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview4.webp',
        caption:
          'The king bed from the other side of the room, with the roller-shaded window and the heating and cooling unit beneath it, and the phone and clock on the nightstand.',
        alt: 'King bed beside a shaded window and heating and cooling unit — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio4.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview3.webp',
        caption:
          'The studio in one frame from the bed: the framed Delicate Arch print, the kitchenette at the far end, the desk with the wall-mounted TV, the armchair and ottoman, and the closet with an iron on its shelf and an ironing board stowed in it.',
        alt: 'Studio room showing kitchenette, desk, TV and closet — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio6.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview5.webp',
        caption:
          'The working half of the room from the foot of the bed: the kitchenette through the opening on the left, the desk and wall-mounted TV, the armchair and ottoman, and the open closet with its hanging rail, hangers, drawers, iron and ironing board.',
        alt: 'Kitchenette, desk, TV, armchair and open closet in an accessible studio — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio-Kitchenette.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-Kitchenette-phoneview.webp',
        caption:
          'The kitchenette: a two-burner cooktop and a stainless single-basin sink set into the granite counter, cabinets above and below, a microwave and a coffee maker, and a full-height refrigerator with a freezer opposite, on tiled flooring.',
        alt: 'Kitchenette with two-burner cooktop, sink, microwave, coffee maker and full-height refrigerator — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview.webp',
        caption:
          'The desk and work area with an office chair and the wall-mounted TV, and the armchair and ottoman under a floor lamp across the corner, looking through to the window and the bed.',
        alt: 'Desk, office chair, TV and armchair in a guest room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Handicaped-Studio/Handicapped-studio1.webp',
        portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview1.webp',
        caption:
          'The open closet beside the window: a hanging rail with wooden hangers, an iron on the shelf above, an ironing board stowed alongside and two drawers below. The window looks out over Vernal, with the heating and cooling unit beneath it.',
        alt: 'Open closet with hangers, iron and ironing board beside a window — Best Western Vernal Inn, Vernal Utah',
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
    // PHOTOGRAPHY (reshot 2026-09-09): the owner's new WebP set in
    // public/images/Pet-Friendly-Double-Queen/. Every frame was opened and
    // matched by what it shows; the old gallery's eleven subjects each have a
    // new frame. The landscape files are numbered Room2–14 with gaps and the
    // Phoneviews 1–9, and the numbers do NOT correspond: the twins below were
    // matched by content (Room13 ↔ phoneview5, Room10 ↔ phoneview2, and so
    // on). Left out, on purpose: Room11 (the beds head-on again, tighter than
    // Room13), Room9 and phoneview9 (the closet from the desk side — Room12
    // shows it with the mirror), phoneview4 (the closet's twin; closets are
    // not hero slides), the two "Labeled" files (Room2 with a caption baked
    // into the pixels), and Bathroom1 / Bathroom2 (the tub and the vanity
    // again, from flatter angles than Bathroom3 and Bathroom5).
    hero: {
      src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room13.webp',
      portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview5.webp',
      caption:
        'Two queen beds on wood-style plank flooring.',
      alt: 'Pet-friendly Studio Two Queen with two queen beds and wood-style floors — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room13.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview5.webp',
        caption:
          'Two queen beds head-on, on light-wood platform frames with panelled headboards and blue covers, sharing a wall light and a nightstand with the room phone and an alarm clock on it. A framed Utah sandstone print hangs on the wall to the left, and wood-style plank flooring runs the width of the room.',
        alt: 'Two queen beds on wood-style plank flooring in a pet-friendly room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room3.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview3.webp',
        caption:
          'The beds from the near corner, showing the panelled headboards, the shared wall light and nightstand, and the entry door at the far left.',
        alt: 'Two queen beds sharing a nightstand and wall light — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room10.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview2.webp',
        caption:
          'The beds from the other corner, with the roller-shaded window and the heating and cooling unit beneath it.',
        alt: 'Pet-friendly room with two beds, window and heating and cooling unit — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room2.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview1.webp',
        caption:
          'The full length of the room from beside the beds: the entry door at the far end, the kitchenette, the dining table with two chairs, the desk with the wall-mounted TV and the ottoman — all on continuous wood-style plank flooring.',
        alt: 'Full view of a pet-friendly studio showing entrance, kitchenette, dining table and wood-style floors — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room7.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview7.webp',
        caption:
          'The kitchenette and dining table by the entrance — the same kitchen configuration as our other rooms: a sink set into the counter, cabinets above and below, a microwave and a coffee maker, with a table and upholstered chairs alongside.',
        alt: 'Kitchenette with sink, microwave and cabinets beside a dining table — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room8.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview8.webp',
        caption:
          'The dining table and chairs with the full-height refrigerator and freezer beside them, and the armchair, floor lamp and wall-mounted TV beyond.',
        alt: 'Dining table, refrigerator and seating area in a pet-friendly room — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room14.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview6.webp',
        caption:
          'The seating corner: an armchair with a matching ottoman under a floor lamp, next to the desk, office chair and wall-mounted TV, with a framed canyon print on the wall.',
        alt: 'Armchair, ottoman and desk with wall-mounted TV on wood-style floors — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room12.webp',
        portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview4.webp',
        caption:
          'The closet unit, with a full-length mirror on one side — the window and its heating and cooling unit reflected in it — an open hanging bay, two drawers and an ironing board stowed to the right.',
        alt: 'Closet unit with full-length mirror, hanging bay, drawers and ironing board — Best Western Vernal Inn, Vernal Utah',
      },
      ...STANDARD_BATHROOM('Pet-Friendly-Double-Queen', 'Pet-Friendly'),
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
    // PHOTOGRAPHED AT LAST (2026-09-09). This page stood for months on a CGI
    // render with a "we have not photographed this room" notice, because no
    // photograph of the $135 room existed. One does now:
    // public/images/Pet-Friendly-King-Suite/.
    //
    // THE EVIDENCE THAT THE FOLDER IS THIS ROOM is the hotel's own, not an
    // inference from the pictures. The folder ships a labelled copy reading
    // "Pet friendly King Suite — $135/night", and $135 is exactly
    // RATES.nightly.petFriendlyRoom. The owner priced and named it themselves.
    //
    // So the bed type IS now confirmed, by that label and by every frame: one
    // king bed. It is published here and in seo.bedType, replacing the old
    // "no confirmed bed type" note. OCCUPANCY IS STILL NOT: the homepage rate
    // table's "Sleeps" cell for this room is an em dash, so `sleeps` stays
    // empty and seo.occupancy is still omitted. One fact arriving does not
    // license the others.
    //
    // Frames matched to their 9:16 twins by content — the numbers do not
    // correspond. Suite7 and Suite5 have no twin in the delivered set and show
    // their landscape frame on a phone. Left out: Suite4 (the entry and
    // kitchenette again, wider than Suite5), Bathroom2 (the bathroom from the
    // doorway, covered by Bathroom1), Suite-phoneview5 (a portrait whose
    // landscape angle was not delivered) and the two "-Labeled" files.
    hero: {
      src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite6.webp',
      portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-phoneview6.webp',
      caption: 'The king bed on wood-style plank flooring.',
      alt: 'Pet-Friendly Room with a king bed and wood-style floors — Best Western Vernal Inn, Vernal Utah',
    },
    gallery: [
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite6.webp',
        portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-phoneview6.webp',
        caption:
          'The king bed head-on against the navy accent wall, on a light-wood platform frame with a panelled headboard, a wall-mounted reading light and a nightstand either side. A framed Delicate Arch print hangs to the left, and wood-style plank flooring runs under the bed.',
        alt: 'King bed with panelled headboard and wall reading lights on wood-style flooring — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite7.webp',
        caption:
          'The bed from the window side, with the roller-shaded window looking out over Vernal, the heating and cooling unit beneath it and the room phone on the nightstand.',
        alt: 'King bed beside a window with a view over Vernal — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite3.webp',
        portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-phoneview3.webp',
        caption:
          'The room in one frame from the entrance: the desk with the wall-mounted TV, the dining table and two upholstered chairs, the window with the heating and cooling unit beneath it, and the foot of the bed on the right — all on continuous wood-style plank flooring.',
        alt: 'Pet-friendly king room showing desk, TV, dining table, window and bed — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite5.webp',
        caption:
          'The entrance end: the kitchenette with a sink in the counter, cabinets above and below, a microwave and a coffee maker, and the dining table with two upholstered chairs beside the door.',
        alt: 'Kitchenette with microwave, coffee maker and dining table beside the entry door — Best Western Vernal Inn, Vernal Utah',
        heroSlide: true,
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite1.webp',
        portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-phoneview1.webp',
        caption:
          'The desk with a leather office chair, a reading lamp and the wall-mounted TV above it.',
        alt: 'Desk with leather office chair and wall-mounted TV — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite.webp',
        portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-phoneview.webp',
        caption:
          'The open closet beside the desk: a full-width hanging rail, an ironing board stowed upright, two drawers below and an open shelf alongside.',
        alt: 'Open closet with hanging rail, drawers and stowed ironing board — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Bathroom1.webp',
        portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-bathroom-phoneview2.webp',
        caption:
          'The bathroom: a granite vanity with a single basin under a backlit mirror, towels on the rail and shelf, the toilet, and the tub and shower beyond. Tiled floor throughout.',
        alt: 'Guest bathroom with granite vanity, backlit mirror, toilet and tub — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-bathroom.webp',
        portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Bathroom-phoneview1.webp',
        caption:
          'The bath: a full-size tub and shower combination with a curved curtain rod, chrome fixtures and a towel rack above the toilet.',
        alt: 'Bathtub and shower combination with curved curtain rod — Best Western Vernal Inn, Vernal Utah',
      },
      {
        src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite2.webp',
        portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-phoneview2.webp',
        caption:
          'The vanity and backlit mirror, with the tub and shower reflected behind and towels within reach.',
        alt: 'Bathroom vanity and backlit mirror reflecting the shower — Best Western Vernal Inn, Vernal Utah',
      },
    ],
    about: [
      'The Pet-Friendly Room is the lower-priced of our two dog-friendly room types, at $135 a night. It sits between the Studio Two Queen and the Pet-Friendly Studio Two Queen on the rate card, and it is the one to book when the dog is coming and there are two of you rather than four.',
      'It is a king room laid on wood-style plank flooring rather than carpet — which is the point of it. Wet paws, shed hair and the occasional accident come off a plank floor in a way they do not come out of carpet. The bed sits on a light-wood platform frame against a navy accent wall, with a wall-mounted reading light and a nightstand on each side, and the window looks out over Vernal.',
      'The room has a kitchenette at the entrance end — a sink in the counter, cabinets, a microwave and a coffee maker — with a dining table and two upholstered chairs beside it. There is a desk with a leather office chair under a wall-mounted TV, and an open closet with a hanging rail, drawers and an ironing board. The bathroom is the property standard: a granite vanity with a backlit mirror, a full-size tub and shower combination, and a tiled floor.',
      'The pet policy is the hotel\'s published one — up to two dogs per room, an 80 lb limit per dog, a $30 per day pet fee and a $100 refundable damage deposit taken at check-in. Ground-floor pet rooms are available so you can take a dog straight outside without stairs or a lift. Free hot breakfast, free WiFi, free parking and a 24-hour front desk come with the room. How many people this room sleeps is the one thing we have not had confirmed, so we do not publish it — call the front desk and ask.',
    ],
    difference:
      'The lower-priced of our two dog-friendly room types at $135: one king bed on wood-style plank flooring, where the $155 Pet-Friendly Studio Two Queen gives you two queens.',
    features: [
      { label: 'Dogs welcome — up to two per room, 80 lb limit each', source: 'site' },
      { label: 'Pet fee $30/day + $100 refundable deposit', source: 'site' },
      { label: 'One king bed', source: 'photo' },
      { label: 'Wood-style plank flooring throughout', source: 'photo' },
      { label: 'Ground-floor pet rooms available', source: 'site' },
      { label: 'Kitchenette — sink, cabinets, microwave and coffee maker', source: 'photo' },
      { label: 'Dining table with two chairs', source: 'photo' },
      { label: 'Desk with leather office chair', source: 'photo' },
      { label: 'Wall-mounted flat-screen TV', source: 'photo' },
      { label: 'Open closet with hanging rail, drawers and ironing board', source: 'photo' },
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
        'Pet-Friendly King Room — $135/Night | Best Western Vernal Inn, Vernal Utah',
      description:
        'Pet-friendly king room in Vernal, Utah: one king bed, wood-style floors, kitchenette and ground-floor access. Up to two dogs, 80 lb limit, $30/day pet fee. $135 per night + tax.',
      bedType: 'King',
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
