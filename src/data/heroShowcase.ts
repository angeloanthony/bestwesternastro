// src/data/heroShowcase.ts
//
// SINGLE SOURCE OF TRUTH for the homepage hero reel.
//
// The hero opens on the two property shots it has always opened on, then walks a
// guest through one room type per slide with the price, the weekly message and a
// booking CTA laid over the photograph. Prices are NOT stored here — every one is
// read out of src/data/rates.ts through nightlyQuote(), so a rate change is still
// a one-line edit in one file and can never drift from the rates table further
// down the same page.
//
// ROOM SET: the six slides below are the hotel's own confirmed rate card
// (2026-09-03, extended 2026-09-09). Every weekly line is the fixed
// WEEKLY_CALL_LINE — no weekly dollar amount is published anywhere on this
// site, by instruction.
//
// THE QUEEN SLIDE IS BACK, and the note that removed it is satisfied rather
// than overridden. It used to read: "a plain Queen slide used to sit between
// King and Double Queen; the rate card has no such room, which also matches
// the asset set (it was the one slide with no real photograph behind it). Do
// not add it back to make the count even." Both of its conditions have since
// changed. The owner delivered a full photographic set in
// public/images/Queen-Suite/ — including a labelled frame reading "Queen
// Suite" over a "$95/night" badge — and named the rate when asking for the
// page. The old bar was "do not invent a room to balance the reel", not "this
// room does not exist", and it is cleared by evidence, not by preference.
//
// It leads the room run because $95 is now the lowest rate on the card.
//
// PHOTOGRAPHY (repointed 2026-09-09). Every room slide now reads the owner's
// reshoot straight out of public/images/<Room-Type>/. The old built crops in
// public/images/rooms/ are gone, and so is the stand-in render that stood in
// for the $135 Pet-Friendly Room — that room has real photography now too.
//
// Each slide carries the owner's own 9:16 "Phoneview" twin as `portrait`, so a
// phone gets a photograph SHOT for a phone rather than a crop of a wide one.
// The twins were matched to their landscape frame by content, not by filename:
// the numbering does not correspond. Frames are the wide, establishing views
// of each room rather than a bed close-up, because the reel lays a price card
// over the lower half.
//
// NO "-Labeled" FILE BELONGS IN THIS REEL. Each folder also holds a copy with
// the room name, and another with the nightly rate, baked into the pixels.
// Both are the wrong choice here for the same reason the header above gives:
// this reel renders its own price card from rates.ts, so a baked-in rate would
// state the price twice and could contradict the rates table the moment a rate
// changes. A photograph must carry no price.

import { RATES, nightlyQuote, WEEKLY_CALL_LINE, type NightlyQuote } from './rates.ts';

export type HeroSlide = {
  id: string;
  /** 'property' slides open the reel with the hotel itself and carry no price card. */
  kind: 'property' | 'room';
  /** Path relative to the site root, without the leading slash (matches legacy markup). */
  image: string;
  /** PHONE version of `image`, at 9:16. Optional: a slide with no portrait
   *  falls back to the landscape one. Since 2026-09-10 every slide's portrait
   *  is the owner's own export, delivered alongside the landscape frame — none
   *  is cropped by scripts/make-portrait-heroes.mjs any more.
   *
   *  It must be 9:16 (0.5625), not merely "tall": below 3:4 the hero stage is
   *  sized to exactly that ratio (global.css, next to .hero-kb), so a portrait
   *  of any other shape is cover-cropped again. A landscape frame in the same
   *  stage keeps only about a third of its width. */
  portrait?: string;
  /** Ken Burns pan direction — classes already defined in global.css. */
  kb: 'kb-right' | 'kb-left' | 'kb-up' | 'kb-down';
  /** Alt text / accessible name for the slide. */
  alt: string;
  /** Short label used by the slide indicators. */
  label: string;
  /** Room slides only. */
  room?: {
    name: string;
    sleeps: string;
    features: string[];
    nightly: NightlyQuote;
    weekly: string;
    /** Optional extra line — used for the pet-fee disclosure. */
    footnote?: string;
  };
};

export const HERO_SLIDES: HeroSlide[] = [
  // THE TWO EXTERIORS (repointed 2026-09-10) — the owner's own 16:9 + 9:16
  // pairs, the same way every room slide below is delivered.
  //
  // The day slide used to be images/31a.webp. It was the same view of the
  // building with a stock golden-retriever puppy, a "PET FRIENDLY" sign and a
  // Best Western watermark composited into the parking lot, captioned "at
  // dusk" over a midday sky — and at 2.5 MB it was the file the head preloads
  // as the page's LCP image. Hotel-DayTime.webp is that view without the
  // additions, at 117 KB.
  //
  // Both phone versions used to be sharp's `attention` crops of the landscape
  // files (scripts/make-portrait-heroes.mjs), cut down to 576x1024. These are
  // the owner's own 940x1672 portrait exports instead. "NithtTime" is the
  // filename as delivered.
  {
    id: 'property-day',
    kind: 'property',
    image: 'images/Hotel-DayTime.webp',
    portrait: 'images/Hotel-DayTime-phoneview.webp',
    kb: 'kb-right',
    alt: 'Best Western Vernal Inn in daylight, with the Best Western sign on the tower above the covered entrance — Vernal, Utah',
    label: 'The Inn',
  },
  {
    id: 'property-stars',
    kind: 'property',
    image: 'images/Hotel-NithtTime.webp',
    portrait: 'images/Hotel-NithtTime-phoneview.webp',
    kb: 'kb-left',
    alt: 'Best Western Vernal Inn lit up at night under a starry sky — Vernal, Utah',
    label: 'Under the Stars',
  },
  {
    id: 'queen-suite',
    kind: 'room',
    image: 'images/Queen-Suite/Queen-Suite.webp',
    portrait: 'images/Queen-Suite/Queen-Suite-phoneview.webp',
    kb: 'kb-right',
    alt: 'Queen Suite with a queen bed and a two-seat sofa under the window — Best Western Vernal Inn, Vernal Utah',
    label: 'Queen Suite',
    room: {
      name: 'Queen Suite',
      // No occupancy claimed: this room has never had a row in the homepage
      // rate table, so there is no published figure to reuse, and a sofa is
      // not evidence that it converts. The room page says the same.
      sleeps: 'Our lowest rate',
      features: ['Queen bed', 'Sofa', 'Kitchenette'],
      nightly: nightlyQuote(RATES.nightly.queenSuite),
      weekly: WEEKLY_CALL_LINE,
    },
  },
  {
    id: 'studio-king',
    kind: 'room',
    image: 'images/King-Studio/King-Studio5.webp',
    portrait: 'images/King-Studio/King-Studio-phoneview5.webp',
    kb: 'kb-up',
    alt: 'Studio King bedroom with platform bed and reading lights — Best Western Vernal Inn, Vernal Utah',
    label: 'Studio King',
    room: {
      name: 'Studio King',
      sleeps: 'Sleeps 1–2',
      features: ['King bed', 'Kitchenette', 'Free WiFi'],
      nightly: nightlyQuote(RATES.nightly.studioKing),
      weekly: WEEKLY_CALL_LINE,
    },
  },
  {
    id: 'studio-two-queen',
    kind: 'room',
    image: 'images/Double-Queen-Studio/Double-Queen5.webp',
    portrait: 'images/Double-Queen-Studio/Double-Queen-Phoneview4.webp',
    kb: 'kb-left',
    alt: 'Studio Two Queen bedroom with two queen beds — Best Western Vernal Inn, Vernal Utah',
    label: 'Studio Two Queen',
    room: {
      name: 'Studio Two Queen',
      sleeps: 'Sleeps 1–4',
      features: ['Two queen beds', 'Kitchenette', 'Free WiFi'],
      nightly: nightlyQuote(RATES.nightly.studioTwoQueen),
      weekly: WEEKLY_CALL_LINE,
    },
  },
  {
    id: 'accessible-studio-king',
    kind: 'room',
    image: 'images/Handicaped-Studio/Handicapped-studio4.webp',
    portrait: 'images/Handicaped-Studio/Handicapped-studio-phoneview3.webp',
    kb: 'kb-down',
    alt: 'Accessible Studio King bedroom with wide turning space — Best Western Vernal Inn, Vernal Utah',
    label: 'Accessible Studio King',
    room: {
      name: 'Handicap / Accessible Studio King',
      sleeps: 'Sleeps 1–2 · ADA',
      features: ['King bed', 'Roll-in shower', 'Wide doorways'],
      nightly: nightlyQuote(RATES.nightly.accessibleStudioKing),
      weekly: WEEKLY_CALL_LINE,
    },
  },
  {
    id: 'pet-friendly-studio-two-queen',
    kind: 'room',
    image: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room2.webp',
    portrait: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Room-phoneview1.webp',
    kb: 'kb-up',
    alt: 'Pet-friendly Studio Two Queen bedroom with wood-style floors — Best Western Vernal Inn, Vernal Utah',
    label: 'Pet-Friendly Studio Two Queen',
    room: {
      name: 'Pet-Friendly Studio Two Queen',
      sleeps: 'Sleeps 1–4 · Dogs welcome',
      features: ['Two queen beds', 'Wood-style floors', 'Ground floor'],
      nightly: nightlyQuote(RATES.nightly.petFriendlyStudioTwoQueen),
      weekly: WEEKLY_CALL_LINE,
      footnote: 'Pet fee $30/day + $100 refundable deposit',
    },
  },
  {
    id: 'pet-friendly-room',
    kind: 'room',
    // Real photography at last, from public/images/Pet-Friendly-King-Suite/.
    // That folder is this room on the hotel's OWN evidence: its labelled copy
    // reads "Pet friendly King Suite — $135/night", and $135 is exactly
    // RATES.nightly.petFriendlyRoom. The render that used to stand in here is
    // gone. The clean frame is used, never the labelled one — the price card
    // over this slide is rendered from rates.ts.
    image: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite3.webp',
    portrait: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-phoneview3.webp',
    kb: 'kb-right',
    alt: 'Pet-friendly king room with desk, dining table and wood-style floors — Best Western Vernal Inn, Vernal Utah',
    label: 'Pet-Friendly Room',
    room: {
      name: 'Pet-Friendly Room',
      // No bed type claimed: the rate card names this one simply "Pet-Friendly
      // Room", and the only asset for it is a render. Wood floors and ground
      // floor are what /pet-friendly-hotel-vernal-utah already states.
      sleeps: 'Dogs welcome',
      features: ['Wood-style floors', 'Ground floor', 'Free WiFi'],
      nightly: nightlyQuote(RATES.nightly.petFriendlyRoom),
      weekly: WEEKLY_CALL_LINE,
      footnote: 'Pet fee $30/day + $100 refundable deposit',
    },
  },
];

/** Index of the first room slide — the reel's price card layer starts here. */
export const FIRST_ROOM_SLIDE = HERO_SLIDES.findIndex((s) => s.kind === 'room');
