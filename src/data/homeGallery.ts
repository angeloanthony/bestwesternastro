// src/data/homeGallery.ts
//
// SINGLE SOURCE OF TRUTH for the homepage "See It for Yourself" gallery.
//
// WHY THIS FILE EXISTS: the gallery used to be two hand-kept lists in
// index.astro — fourteen `<div class="gi" onclick="ola(N)">` tiles, and a
// separate 22-entry `imgs` array the lightbox indexed with that same N. They
// had drifted completely out of step. Tile 3 showed images/40.webp (a "Standard
// King" render) and `ola(3)` opened `imgs[3]`, images/41.webp — a different
// room. Every room tile in the grid opened the wrong photograph, and had done
// since the two lists were last edited independently.
//
// The grid and the lightbox are now rendered from the one array below, so an
// index cannot disagree with a picture: there is only one list to get right.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE ROOM TILES CARRY A PRICE BAKED INTO THE PIXELS.
//
// These are the owner's own labelled exports — the room name and the nightly
// rate are part of the photograph, not markup over it. That is what the hotel
// asked for here, and on a gallery tile it reads as a rate card rather than as
// a caption.
//
// It also breaks the rule the rest of the site runs on. rates.ts exists because
// a price hardcoded in twenty places drifted, and its header is explicit: edit
// the number there and every page follows. A number burned into a WebP cannot
// follow anything. If a rate moves, these files are stale until the owner
// re-exports them, and a stale one contradicts the rate table further down the
// same page — which is precisely the "guest quoting a price the front desk
// won't honor" failure rates.ts was built to end.
//
// So each room tile records the price its picture has burned into it, and
// assertPricesMatchRateCard() below refuses the build when that stops matching
// RATES.nightly. The drift is still possible; it can just no longer ship
// silently. Change a rate and the build tells you which photograph to re-export.
// ─────────────────────────────────────────────────────────────────────────────

import { RATES } from './rates.ts';

export type GalleryTile = {
  /** Path from the site root, without the leading slash (matches legacy markup). */
  src: string;
  /** Overlay label on the tile, and the lightbox caption. */
  label: string;
  alt: string;
  /** Spans two grid columns. Two of these, opening and mid-way. */
  wide?: boolean;
  /**
   * Set on the room tiles only: the RATES.nightly key whose value is printed
   * into this photograph. Guarded at build time — see the note above.
   */
  rateKey?: keyof typeof RATES.nightly;
};

// The room tiles are in rate order, cheapest first, matching the rate table and
// the nav dropdown. The labels are OUR room names, not the wording burned into
// the pictures: the owner's exports say "King Suite Room", "King Handicap
// Suite" and "Standard Double Queen Room", which are not the names the rate
// card, the room pages or the nav use. A guest should read one name per room.
export const HOME_GALLERY: GalleryTile[] = [
  {
    src: 'images/61.webp',
    label: 'Hotel Exterior',
    alt: 'Best Western Vernal Inn exterior lit at night — Vernal, Utah',
    wide: true,
  },
  {
    src: 'images/35.webp',
    label: 'Under the Stars',
    alt: 'Best Western Vernal Inn under a night sky — Vernal, Utah',
  },

  // ── The rooms ──────────────────────────────────────────────────────────────
  {
    // Re-exported by the owner 2026-09-17: the picture now reads "Studio Queen"
    // over "$95/night" (it said "Queen Suite" until then). The folder was
    // renamed Queen-Suite/ → Queen-Studio/ the same day; the filename kept its
    // old wording, which guests never see.
    src: 'images/Queen-Studio/Queen-Suite-Labeled-$95.webp',
    label: 'Studio Queen',
    alt: 'Studio Queen with a queen bed and a two-seat sofa — $95 a night at Best Western Vernal Inn, Vernal Utah',
    rateKey: 'studioQueen',
  },
  {
    src: 'images/King-Studio/King-Studio-$108.webp',
    label: 'Studio King',
    alt: 'Studio King with a desk, kitchenette and dining table — $108 a night at Best Western Vernal Inn, Vernal Utah',
    rateKey: 'studioKing',
  },
  {
    src: 'images/Double-Queen-Studio/Double-Queen-Studio-$120.webp',
    label: 'Studio Two Queen',
    alt: 'Studio Two Queen with a kitchenette, dining table, desk and armchair — $120 a night at Best Western Vernal Inn, Vernal Utah',
    rateKey: 'studioTwoQueen',
  },
  {
    // Re-exported by the owner at $120 on 2026-09-17, the day the rate moved
    // from $108 — the old Handicapped-studio-$108.webp tile was withdrawn in
    // between. After the Studio Two Queen because the two now share $120 and
    // ROOMS lists it right after that room. Its label already reads
    // "Accessible Studio King".
    src: 'images/Handicaped-Studio/Handicapped-studio-$120.webp',
    label: 'Accessible Studio King',
    alt: 'Accessible Studio King with a king bed, kitchenette, desk, armchair and open closet — $120 a night at Best Western Vernal Inn, Vernal Utah',
    rateKey: 'accessibleStudioKing',
  },
  {
    src: 'images/Pet-Friendly-King-Suite/Pet-Friendly-King-Suite-Labeled-$135.webp',
    label: 'Pet-Friendly Room',
    alt: 'Pet-friendly king room with wood-style floors and a window over Vernal — $135 a night at Best Western Vernal Inn, Vernal Utah',
    rateKey: 'petFriendlyRoom',
  },
  {
    src: 'images/Pet-Friendly-Double-Queen/Pet-Friendly-Double-Queen-Labeled-$155.webp',
    label: 'Pet-Friendly Studio Two Queen',
    alt: 'Pet-friendly studio with two queen beds, a kitchenette and wood-style floors — $155 a night at Best Western Vernal Inn, Vernal Utah',
    rateKey: 'petFriendlyStudioTwoQueen',
  },

  // The Studio Jacuzzi King is DELIBERATELY ABSENT, and only one thing is now
  // missing. Its picture is ready: the owner re-exported
  // images/Jacuzzi-Studio/Jacuzzi-Studio-Labeled-$149.webp on 2026-09-17,
  // correctly labelled "Studio Jacuzzi King" over "$149/night". But
  // RATES.nightly.studioJacuzziKing is still null — the owner has not confirmed
  // that rate in writing — so the homepage table prints "Call for rate", and a
  // tile advertising $149 a few hundred pixels above it is exactly the
  // contradiction this file's guard exists to prevent (the guard would reject
  // it anyway: a printed price against a null rate). Confirm the rate in
  // rates.ts and add the tile here with `rateKey: 'studioJacuzziKing'`, on the
  // same terms as the room tiles above.

  // ── Breakfast ──────────────────────────────────────────────────────────────
  {
    src: 'images/Breakfast-Room-and-Foyer.webp',
    label: 'Breakfast Room & Foyer',
    alt: 'Breakfast room looking through to the foyer and entrance — Best Western Vernal Inn, Vernal Utah',
    wide: true,
  },
  {
    src: 'images/Breakfast-Room7.webp',
    label: 'Hot Breakfast, Included',
    alt: 'Breakfast service counter with coffee machines, fresh fruit and hot food — Best Western Vernal Inn, Vernal Utah',
  },
  {
    // Room1 rather than Room4: both are the dining room, but this one has the
    // lounge sofas in frame, so the four breakfast tiles show four things
    // rather than the same tables from four angles.
    src: 'images/Breakfast-Room1.webp',
    label: 'Breakfast Dining Room',
    alt: 'Breakfast dining room with marble-topped tables and a lounge seating area beyond — Best Western Vernal Inn, Vernal Utah',
  },
  {
    src: 'images/Breakfast-Room6.webp',
    label: 'Coffee & Fresh Fruit',
    alt: 'Coffee machines and a fruit basket beside the breakfast seating — Best Western Vernal Inn, Vernal Utah',
  },
];

/**
 * Refuses the build when a rate moves out from under a photograph that has the
 * old number printed on it. Runs at module load, so `astro build` fails rather
 * than publishing a gallery that contradicts the rate table below it.
 */
function assertPricesMatchRateCard(): void {
  const stale = HOME_GALLERY.filter((t) => t.rateKey !== undefined).flatMap((t) => {
    const key = t.rateKey as keyof typeof RATES.nightly;
    const current = RATES.nightly[key];
    // The price is read back out of the filename, which is where the owner's
    // export puts it, so there is no third copy of the number to keep in step.
    const printed = Number(/-\$(\d+)\.webp$/.exec(t.src)?.[1]);
    if (!Number.isFinite(printed)) {
      return [`${t.src} — no "-$<price>" in the filename, so its baked price cannot be checked`];
    }
    if (current === null) {
      return [`${t.label}: the picture prints $${printed}, but RATES.nightly.${key} is null (unpublished)`];
    }
    return current === printed
      ? []
      : [`${t.label}: the picture prints $${printed}, but RATES.nightly.${key} is now $${current}`];
  });

  if (stale.length) {
    throw new Error(
      'Homepage gallery: a nightly rate no longer matches the price printed into its photograph.\n' +
        stale.map((s) => `  - ${s}`).join('\n') +
        '\nRe-export the labelled image at the new price, then update the filename here.\n' +
        'See the note at the top of src/data/homeGallery.ts.'
    );
  }
}

assertPricesMatchRateCard();
