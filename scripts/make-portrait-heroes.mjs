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
// about 42% of it. The real fix was always a reshoot, and it has happened.
//
// SOURCES — ONLY THE TWO EXTERIORS ARE BUILT HERE NOW (2026-09-09)
// The owner re-photographed every room and delivered a 9:16 "Phoneview" twin
// alongside each landscape frame, so all five room slides in heroShowcase.ts
// point at real portrait photographs and none is cropped here any more. The
// exteriors are the only slides with no portrait original.
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
  // NOTHING IS BUILT HERE ANY MORE (2026-09-10).
  //
  // The two exteriors were the last entries: 31a.webp and 35.webp, cropped by
  // `attention` to 576x1024. The owner has since delivered real 940x1672
  // portrait exports of both (public/images/Hotel-DayTime-phoneview.webp and
  // Hotel-NithtTime-phoneview.webp), and heroShowcase.ts points at those. Every
  // slide in the reel now has a photograph shot or exported for a phone, so
  // running this would only regenerate public/images/portrait/31a.webp and
  // 35.webp, which nothing references. Kept, empty, so the reasoning above
  // survives if a slide ever arrives without a portrait original again.
  //
  // NO ROOM SLIDE IS BUILT HERE ANY MORE (2026-09-09).
  //
  // This script existed because four of the five room types had no portrait
  // photography at all and the fifth had only landscape frames to crop. The
  // owner's reshoot delivered a 9:16 "Phoneview" twin alongside every
  // landscape frame, for all five, so heroShowcase.ts now points at those
  // files directly. A photograph SHOT for a phone beats any crop of a wide
  // one: a crop cannot invent the room that was never in the frame, it only
  // decides which part survives.
  //
  // The two exteriors above stay. They are the only slides with no portrait
  // original, and at 1.50:1 they are the widest sources in the reel — the ones
  // a phone's centre crop punishes hardest.
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
  "\n  Room slides are not built here — they use the owner's own 9:16 Phoneview\n" +
    '  photographs, wired directly in src/data/heroShowcase.ts.\n'
);
