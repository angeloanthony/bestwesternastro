// src/data/homeRoomTabs.ts
//
// SINGLE SOURCE OF TRUTH for the homepage "Every Room Feels Like Home" tabs.
//
// WHY THIS FILE EXISTS
//
// The section used to be ~320 lines of hand-written markup in index.astro, and
// every photograph in it was a CGI render from the pre-2026 asset set —
// images/37–54.webp, the files rooms.ts describes as "NOT PHOTOGRAPHS" with a
// caption baked into the pixels. It had drifted badly from the hotel:
//
//   • Seven tabs — "Standard Queen", "Standard King", "Double Queen", "King
//     Suite", "Jacuzzi Suites", "Pet Friendly", "Accessible Room" — of which
//     three ("Standard Queen", "Standard King", "Double Queen") are not names
//     on the rate card at all, and the rooms the hotel actually sells (Queen
//     Suite, Studio King, Studio Two Queen, Accessible Studio King and the two
//     pet-friendly types) appeared under none of them.
//   • The same render did duty as two different rooms: images/53.webp was
//     captioned "Jacuzzi Double Queen Suite — View 2" in one panel and "Pet
//     Friendly King Room" in the next, while its own baked caption reads
//     "Standard KING — Pet Friendly".
//   • The ADA panel carried "TODO: Replace with actual handicap room image
//     number" and showed a render of a standard king.
//
// So the section is now generated from ROOMS — the same data the /rooms/ pages,
// the hero reel and the rate table read — and every frame in it is one of the
// owner's own photographs, cited by filename out of that room's gallery. The
// alt text and the lightbox caption come from rooms.ts too, so a correction
// there fixes the homepage in the same edit. A filename that does not resolve
// fails the build rather than shipping a broken tile.
//
// EVERY TAB IS DRIVEN BY ROOMS, the Studio Jacuzzi King's included. Until
// 2026-09-16 that one was written out by hand here, because the room had
// photographs but no page. It has a page now; its nightly rate is still null
// pending confirmation, which priceTag() renders as "Call for rate" without any
// special case.
//
// WHAT THE COPY MAY SAY. The panel prose is the room's own `about[0]` and the
// frame's own `caption` from rooms.ts, both already held to that file's
// evidence rule. The headlines and the pills below are written here, and the
// same rule applies to them: every pill names a `features` entry of that room,
// and no headline claims anything the cited photograph does not show. Note the
// Pet-Friendly Room's kitchenette has a sink, microwave and coffee maker but no
// cooktop in its feature list, and its pill says so.

import { ROOMS, roomHref, type Room, type RoomPhoto } from './rooms.ts';

export type RoomTabPanel = {
  /** Path from the site root, without the leading slash (matches legacy markup). */
  src: string;
  alt: string;
  /** Lightbox caption when the frame is opened. */
  caption: string;
  /** Gold eyebrow above the headline. */
  tag: string;
  /** Serif headline. May contain `<br>` and `<em>`. */
  title: string;
  desc: string;
  /** Pill labels. Each one must correspond to a `features` entry of the room. */
  pills: string[];
  link?: { href: string; label: string };
};

export type RoomTab = {
  /** Suffix of the panel's DOM id and the argument to st() — `t-${id}`. */
  id: string;
  /** Tab button label. */
  label: string;
  panels: RoomTabPanel[];
};

function roomBySlug(slug: string): Room {
  const room = ROOMS.find((r) => r.slug === slug);
  if (!room) {
    throw new Error(
      `homeRoomTabs: no room in ROOMS with slug "${slug}". ` +
        `Either the slug changed in rooms.ts or the room was removed.`
    );
  }
  return room;
}

/**
 * A frame out of a room's own gallery, by filename. Throws rather than
 * rendering a broken tile: these paths are the one thing here that can go stale
 * silently when a room's gallery is re-cut.
 */
function frame(room: Room, file: string): RoomPhoto {
  const hit = room.gallery.find((p) => p.src.endsWith(`/${file}`));
  if (!hit) {
    throw new Error(
      `homeRoomTabs: ${room.slug} has no gallery frame named "${file}". ` +
        `Pick one of: ${room.gallery.map((p) => p.src.split('/').pop()).join(', ')}`
    );
  }
  return hit;
}

/** "Studio Queen · $95 a night", or "Studio Jacuzzi King · Call for rate". */
function priceTag(room: Room): string {
  return room.nightly.published
    ? `✦ ${room.shortName} · ${room.nightly.price} a night`
    : `✦ ${room.shortName} · Call for rate`;
}

/** The first panel of a room's tab: its lead photograph, and the paragraph the
 *  room page opens with. */
function leadPanel(
  room: Room,
  file: string,
  title: string,
  pills: string[]
): RoomTabPanel {
  const photo = frame(room, file);
  return {
    src: photo.src,
    alt: photo.alt,
    caption: photo.caption,
    tag: priceTag(room),
    title,
    desc: room.about[0],
    pills,
    link: { href: roomHref(room.slug), label: `${room.shortName} — Full Details →` },
  };
}

/** A supporting panel: the frame's own caption is the copy. */
function detailPanel(
  room: Room,
  file: string,
  tag: string,
  title: string,
  pills: string[]
): RoomTabPanel {
  const photo = frame(room, file);
  return {
    src: photo.src,
    alt: photo.alt,
    caption: photo.caption,
    tag: `✦ ${tag}`,
    title,
    desc: photo.caption,
    pills,
  };
}

// ── Every room with a page ───────────────────────────────────────────────────
// In ROOMS order, which is the order the rate table and the nav dropdown use.
// Three frames each: the beds, the living or working half, and the kitchenette
// — chosen so a guest flicking through the tabs sees three different things per
// room rather than the same bed from three angles.

const queenSuite = roomBySlug('studio-queen'); // the Studio Queen, "Queen Suite" until 2026-09-16
const studioKing = roomBySlug('studio-king');
const studioTwoQueen = roomBySlug('studio-two-queen');
const accessibleStudioKing = roomBySlug('accessible-studio-king');
const petFriendlyStudioTwoQueen = roomBySlug('pet-friendly-studio-two-queen');
const petFriendlyRoom = roomBySlug('pet-friendly-room');
const studioJacuzziKing = roomBySlug('studio-jacuzzi-king');

export const ROOM_TABS: RoomTab[] = [
  {
    id: 'studio-queen',
    label: queenSuite.shortName,
    panels: [
      leadPanel(
        queenSuite,
        'Queen-Suite.webp',
        'One Queen, a Sofa,<br><em>and Our Lowest Rate.</em>',
        ['🛏️ Queen Bed', '🛋️ Two-Seat Sofa', '🍳 Kitchenette', '🧊 Fridge & Freezer', '📶 Free WiFi']
      ),
      detailPanel(
        queenSuite,
        'Queen-Suite6.webp',
        'The Working Half',
        'A Desk, a Closet,<br><em>and the TV Above It.</em>',
        ['💼 Desk & Office Chair', '📺 Wall-Mounted TV', '🚪 Open Closet', '❄️ In-Room Heat & A/C']
      ),
      detailPanel(
        queenSuite,
        'Queen-Suite7.webp',
        'The Kitchenette',
        'Sink, Cooktop,<br><em>Microwave, Coffee.</em>',
        ['🍳 Two-Burner Cooktop', '🔥 Microwave', '☕ Coffee Maker', '🧊 Full-Height Fridge']
      ),
    ],
  },
  {
    id: 'studio-king',
    label: studioKing.shortName,
    panels: [
      leadPanel(
        studioKing,
        'King-Studio.webp',
        'One King Bed.<br><em>The Whole Studio.</em>',
        ['🛏️ King Bed', '🍳 Kitchenette', '💼 Work Desk', '🍽️ Dining Table', '📶 Free WiFi']
      ),
      detailPanel(
        studioKing,
        'King-Studio3.webp',
        'The Working Half',
        'Desk on One Side.<br><em>Armchair on the Other.</em>',
        ['💼 Desk & Office Chair', '🛋️ Armchair & Ottoman', '📺 Wall-Mounted TV', '🚪 Open Closet']
      ),
      detailPanel(
        studioKing,
        'King-Studio12.webp',
        'The Kitchenette',
        'A Real Kitchen.<br><em>Not a Mini Fridge.</em>',
        ['🍳 Kitchenette', '🔥 Microwave', '☕ Coffee Maker', '🧊 Fridge & Freezer']
      ),
    ],
  },
  {
    id: 'studio-two-queen',
    label: studioTwoQueen.shortName,
    panels: [
      leadPanel(
        studioTwoQueen,
        'Double-Queen1.webp',
        'Two Queen Beds.<br><em>Room for Four.</em>',
        ['🛏️ Two Queen Beds', '👨‍👩‍👧 Sleeps 1–4', '🍳 Kitchenette', '🍽️ Dining Table', '📶 Free WiFi']
      ),
      detailPanel(
        studioTwoQueen,
        'Double-Queen4.webp',
        'Everything in One Frame',
        'Kitchen, Table, Desk<br><em>and Closet — All Open.</em>',
        ['🛋️ Armchair & Ottoman', '💼 Desk & Office Chair', '🚪 Open Closet', '🧺 Iron & Ironing Board']
      ),
      detailPanel(
        studioTwoQueen,
        'Double-Queen6.webp',
        'Sit Down to Eat',
        'A Table for Two,<br><em>and a Fridge Worth Filling.</em>',
        ['🍽️ Dining Table & Chairs', '🧊 Full-Height Fridge', '🍳 Two-Burner Cooktop', '☕ Coffee Maker']
      ),
    ],
  },
  {
    id: 'accessible-studio-king',
    label: accessibleStudioKing.shortName,
    panels: [
      leadPanel(
        accessibleStudioKing,
        'Handicapped-studio7.webp',
        'A King Bed — and<br><em>Room to Move Around It.</em>',
        ['♿ Accessible Fixtures', '🛏️ King Bed', '↔️ Clear Floor Space Both Sides', '🍳 Kitchenette', '📶 Free WiFi']
      ),
      detailPanel(
        accessibleStudioKing,
        'Handicapped-studio-bathroom2.webp',
        'The Roll-In Shower',
        'Low Threshold. Grab Bars.<br><em>A Seat That Folds Down.</em>',
        ['🚿 Roll-In Shower', '🪑 Fold-Down Seat', '🤝 Grab Bars', '🚰 Handheld Sprayer']
      ),
      detailPanel(
        accessibleStudioKing,
        'Handicapped-studio4.webp',
        'The Same Studio',
        'Same Kitchenette.<br><em>Same Studio Layout.</em>',
        ['🍳 Kitchenette', '🧊 Fridge & Freezer', '💼 Desk & Wall TV', '🛋️ Armchair & Ottoman']
      ),
    ],
  },
  {
    id: 'pet-friendly-studio-two-queen',
    label: petFriendlyStudioTwoQueen.shortName,
    panels: [
      leadPanel(
        petFriendlyStudioTwoQueen,
        'Pet-Friendly-Double-Queen-Room13.webp',
        'Two Queens, Wood Floors,<br><em>and the Dog Comes Too.</em>',
        ['🐾 Dogs Welcome', '🛏️ Two Queen Beds', '🪵 Wood-Style Plank Floors', '👨‍👩‍👧 Sleeps 1–4', '🍳 Kitchenette']
      ),
      detailPanel(
        petFriendlyStudioTwoQueen,
        'Pet-Friendly-Double-Queen-Room2.webp',
        'End to End',
        'One Open Studio,<br><em>Plank Floor Throughout.</em>',
        ['🪵 Wood-Style Plank Floors', '🍽️ Dining Table', '💼 Desk & Wall TV', '🛋️ Armchair & Ottoman']
      ),
      detailPanel(
        petFriendlyStudioTwoQueen,
        'Pet-Friendly-Double-Queen-Room7.webp',
        'The Kitchenette',
        'The Same Kitchen<br><em>as Every Other Room.</em>',
        ['🍳 Two-Burner Cooktop', '🔥 Microwave', '☕ Coffee Maker', '🧊 Fridge & Freezer']
      ),
    ],
  },
  {
    id: 'pet-friendly-room',
    label: petFriendlyRoom.shortName,
    panels: [
      leadPanel(
        petFriendlyRoom,
        'Pet-Friendly-King-Suite6.webp',
        'Bring the Dog.<br><em>King Bed, Plank Floors.</em>',
        ['🐾 Dogs Welcome', '🛏️ King Bed', '🪵 Wood-Style Plank Floors', '🚪 Ground-Floor Rooms Available', '📶 Free WiFi']
      ),
      detailPanel(
        petFriendlyRoom,
        'Pet-Friendly-King-Suite3.webp',
        'The Room in One Frame',
        'Desk, Table, Window,<br><em>and the Foot of the Bed.</em>',
        ['💼 Desk & Leather Chair', '📺 Wall-Mounted TV', '🍽️ Dining Table', '❄️ In-Room Heat & A/C']
      ),
      detailPanel(
        petFriendlyRoom,
        'Pet-Friendly-King-Suite5.webp',
        'The Kitchenette',
        'Cook Here.<br><em>Then Take the Dog Out.</em>',
        ['🍳 Sink & Cabinets', '🔥 Microwave', '☕ Coffee Maker', '🍽️ Table by the Door']
      ),
    ],
  },

  // Driven by ROOMS like the others since 2026-09-16, when the room got its
  // page; it used to be written out by hand here. Its tag reads "Call for rate"
  // through priceTag() while RATES.nightly.studioJacuzziKing is null, and turns
  // into the price by itself once that is confirmed.
  {
    id: 'studio-jacuzzi-king',
    label: studioJacuzziKing.shortName,
    panels: [
      leadPanel(
        studioJacuzziKing,
        'Jacuzzi-Suite1.webp',
        'A Corner Jacuzzi,<br><em>Right There in the Room.</em>',
        ['🛁 In-Room Corner Jacuzzi', '🛏️ King Bed', '🛋️ Two-Seat Sofa', '🍳 Kitchenette', '📶 Free WiFi']
      ),
      detailPanel(
        studioJacuzziKing,
        'Jacuzzi-Suite9.webp',
        'The Bed and the Sofa',
        'A King Bed,<br><em>and Somewhere Else to Sit.</em>',
        ['🛏️ King Bed', '🛋️ Two-Seat Sofa', '💡 Wall Reading Lights', '❄️ In-Room Heat & A/C']
      ),
      detailPanel(
        studioJacuzziKing,
        'Jacuzzi-Suite6.webp',
        'The Working End',
        'Desk, TV,<br><em>and the Kitchenette Beside It.</em>',
        ['💼 Desk & Leather Chair', '📺 Wall-Mounted TV', '🍳 Two-Burner Cooktop', '🧊 Full-Height Fridge']
      ),
    ],
  },
];
