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
// ROOM SET: the five slides below are the hotel's own confirmed rate card
// (2026-09-03). Every weekly line is the fixed WEEKLY_CALL_LINE — no weekly
// dollar amount is published anywhere on this site, by instruction. A plain
// Queen slide used to sit between King and Double Queen; the rate card has no
// such room, which also matches the asset set (it was the one slide with no real
// photograph behind it). Do not add it back to make the count even.
//
// PHOTOGRAPHY: public/images/rooms/*.webp are built from the owner-supplied room
// photographs in public/images/<Room-Type>/. Two caveats before swapping any:
//   • The owner's room folders share files across room types (the same bathroom
//     photo appears under King, Double Queen and Pet Friendly), so only images
//     unique to a folder were treated as evidence of that room type.
//   • pet-friendly-room.webp is TEMPORARY — see the slide itself.

/* ⚠️ TEMPORARY IMAGE — Pet-Friendly Room ($135)
 *
 * images/rooms/pet-friendly-room.webp is the site's existing "Standard King —
 * Pet Friendly" render (53.webp) with its baked-in caption cropped off. It is
 * the only slide in the reel not backed by a photograph, and it is a stand-in:
 * no photograph of the $135 Pet-Friendly Room exists in the asset set yet.
 *
 * REPLACE IT as soon as the hotel supplies one — swap the `image` path on the
 * 'pet-friendly-room' slide and delete this note. Nothing else needs to change.
 *
 * It must NOT be swapped for anything from public/images/Pet-Friendly-Double-Queen/:
 * every file in that folder is the Pet-Friendly Studio Two Queen, a DIFFERENT
 * room type at a different price ($155). Pairing that photograph with the $135
 * rate would advertise one room and charge for another. */

import { RATES, nightlyQuote, WEEKLY_CALL_LINE, type NightlyQuote } from './rates.ts';

export type HeroSlide = {
  id: string;
  /** 'property' slides open the reel with the hotel itself and carry no price card. */
  kind: 'property' | 'room';
  /** Path relative to the site root, without the leading slash (matches legacy markup). */
  image: string;
  /** PHONE version of `image`, cropped or shot to 9:16. Optional: a slide with
   *  no portrait falls back to the landscape one, which is what the widest and
   *  softest source (pet-friendly-room) does. Built by
   *  scripts/make-portrait-heroes.mjs — regenerate rather than hand-crop, and
   *  read the WHY at the top of it before changing a crop.
   *
   *  This exists because `background-size: cover` on a 100vh phone hero keeps
   *  only 31-35% of a landscape photograph's width. */
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
  {
    id: 'property-night',
    kind: 'property',
    image: 'images/31a.webp',
    portrait: 'images/portrait/31a.webp',
    kb: 'kb-right',
    alt: 'Best Western Vernal Inn at dusk — Vernal, Utah',
    label: 'The Inn',
  },
  {
    id: 'property-stars',
    kind: 'property',
    image: 'images/35.webp',
    portrait: 'images/portrait/35.webp',
    kb: 'kb-left',
    alt: 'Best Western Vernal Inn under the stars — Vernal, Utah',
    label: 'Under the Stars',
  },
  {
    id: 'studio-king',
    kind: 'room',
    image: 'images/rooms/king.webp',
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
    image: 'images/rooms/double-queen.webp',
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
    // The rooms section still shows 47.webp here behind a "replace with the
    // actual handicap room image" TODO. This is that actual photograph.
    image: 'images/rooms/accessible.webp',
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
    image: 'images/rooms/pet-friendly.webp',
    portrait: 'images/portrait/pet-friendly.webp',
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
    // ⚠️ TEMPORARY stand-in render — see the note at the top of this file.
    image: 'images/rooms/pet-friendly-room.webp',
    kb: 'kb-right',
    alt: 'Pet-friendly room with kitchenette and wood-style floors — Best Western Vernal Inn, Vernal Utah',
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
