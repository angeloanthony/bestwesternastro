// scripts/make-portrait-heroes.mjs
//
// Builds the PHONE versions of the hero slideshow photographs.
//
// WHY THIS EXISTS
// The hero photographs are landscape, 1.33:1 to 2.09:1. A phone hero is a
// 100vh box at roughly 0.46:1, and `background-size: cover` fills it by height
// and throws away the width. Measured on a 390x844 phone, that leaves only
// 31-35% of each photograph on screen — 22% for the widest of them. That is
// why a phone showed a nightstand where a desktop showed a room.
//
// A portrait crop cannot invent room that was never in the frame; it only
// decides WHICH part survives instead of letting the browser take the middle.
// Cropping to 9:16 raises what a phone sees from about a third of the width to
// about 42% of it, and puts the bed rather than the furniture beside it in the
// middle of the frame. The real fix for the four room types that have no
// portrait photography at all is a reshoot — see the report this prints.
//
// SOURCES
// Where a genuine portrait photograph of the room exists it is used instead of
// a crop. Only Pet-Friendly Studio Two Queen has any: public/images/
// Pet-Friendly-Double-Queen/ holds twelve portrait room shots. (That folder is
// the Pet-Friendly Studio TWO QUEEN at $155, not the $135 Pet-Friendly Room —
// see the warning in src/data/heroShowcase.ts before reusing anything in it.)
//
// Run: node scripts/make-portrait-heroes.mjs
// Output: public/images/portrait/*.webp, referenced from heroShowcase.ts.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

/** Phone heroes are cropped to 9:16 rather than to the ~0.46:1 of the tallest
 *  phones. A frame that tall is unusable on a short phone or a small tablet,
 *  and cover-cropping 9:16 down to 0.46 costs only another 18% of the width. */
const AR = 9 / 16;
const OUT = 'public/images/portrait';

/** `attention` puts sharp's highest-entropy region in frame, which on these
 *  photographs finds the bed; `centre` is used where the subject is already
 *  centred and attention drifts toward a lamp or a window. Chosen per image by
 *  looking at the output, not by rule. */
const SLIDES = [
  // The two exterior shots are the widest sources at 1.50:1, so the browser's
  // own centre crop throws away half of each. These gain the most.
  { id: 'exterior-day', src: 'public/images/31a.webp', out: '31a.webp', crop: 'attention' },
  { id: 'exterior-dusk', src: 'public/images/35.webp', out: '35.webp', crop: 'attention' },
  {
    // The one slide backed by a real portrait photograph rather than a crop,
    // and the only room type that has any: twelve of them, in a folder that is
    // the Pet-Friendly Studio TWO QUEEN at $155, NOT the $135 Pet-Friendly
    // Room — see the warning in heroShowcase.ts before reusing anything there.
    id: 'pet-friendly-studio-two-queen',
    src: 'public/images/Pet-Friendly-Double-Queen/PetFriendly-Double-Queen1.jpeg',
    out: 'pet-friendly.webp',
    crop: 'attention',
    heightScale: 0.9,
    note: 'genuine portrait photograph, not a crop',
  },

  // DELIBERATELY ABSENT, and this is the finding worth keeping:
  //
  //   studio-king, studio-two-queen, accessible-studio-king
  //
  // Cropping them to portrait made them WORSE, measured by rendering each one
  // through an actual 390x844 cover-crop and comparing. Their sources are 4:3,
  // not wide, and all three are shot with the bed centred — so the browser's
  // own centre crop already lands on the bed, keeps the full height, and gets
  // the headboard, lamps and framed art in frame. Feeding it a 9:16 asset just
  // means it crops a second time, to a tighter view that loses the lamps and
  // reads as a mattress. A portrait asset only helps where the source is wide
  // (the exteriors) or where a real portrait photograph exists.
  //
  //   pet-friendly-room
  //
  // Its landscape source is itself a temporary stand-in render (heroShowcase.ts)
  // at 1920x918; a 9:16 crop is 516px wide, too soft for a phone, and frames a
  // desk rather than the room.
  //
  // All four fall back to their landscape image on phones, which the markup
  // supports per-slide. Give any of them a real portrait photograph and it can
  // be added here.
];

mkdirSync(OUT, { recursive: true });

const rows = [];
for (const s of SLIDES) {
  const m = await sharp(s.src).metadata();
  /* heightScale trims dead ceiling or floor before the width crop. Without it
     the crop keeps the source's full height, and on a photograph shot with
     headroom that is what a phone spends its top third showing. */
  const height = Math.round(m.height * (s.heightScale ?? 1));
  const width = Math.round(height * AR);
  const position = s.crop === 'attention' ? sharp.strategy.attention : sharp.gravity.centre;
  const info = await sharp(s.src)
    .resize(width, height, { fit: 'cover', position })
    .webp({ quality: 82 })
    .toFile(`${OUT}/${s.out}`);
  rows.push({
    id: s.id,
    out: s.out,
    from: `${m.width}x${m.height}`,
    to: `${info.width}x${info.height}`,
    kb: Math.round(info.size / 1024),
    crop: s.crop,
    note: s.note ?? '',
    // A phone at 390pt asks for 780 device px at 2x, 1170 at 3x.
    soft: info.width < 780 ? 'SOFT at 2x' : info.width < 1170 ? 'soft at 3x' : 'ok',
  });
}

console.log('\nPortrait hero images written to ' + OUT + '\n');
for (const r of rows) {
  console.log(
    `  ${r.out.padEnd(22)} ${r.from.padEnd(10)} -> ${r.to.padEnd(10)} ${String(r.kb).padStart(4)} KB  ${r.crop.padEnd(9)} ${r.soft.padEnd(11)} ${r.note}`
  );
}
console.log(
  '\n  pet-friendly-room.webp: no portrait version — falls back to its landscape image.\n'
);
