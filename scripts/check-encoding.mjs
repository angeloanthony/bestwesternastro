// Encoding guard — fails the build on UTF-8 BOMs and mojibake in tracked text files.
//
// WHY THIS EXISTS
// On 2026-08-04, commit 60a7552 corrupted five page files. A find-and-replace
// read them with the platform default encoding instead of UTF-8: on Windows
// that is the ANSI code page (CP1252), so "—" (E2 80 94) decoded to "â€”" and
// the files were written back as UTF-8 *with a BOM*. 212 corrupted sequences
// reached the built HTML, including JSON-LD that Google parses.
//
// Nothing caught it. Prettier, ESLint and `astro build` all passed — the bytes
// are valid UTF-8, the characters are simply wrong. Static analysis cannot see
// the difference between an em dash and "â€”". Only a byte-level check can.
//
// THE RULE THIS ENFORCES
// Any tool that reads or writes text in this repo must state UTF-8 explicitly
// rather than inherit a platform default. That applies to PowerShell, Python,
// Node, and editors alike — the platform default is the bug, not any one tool.
//
// Usage:  node scripts/check-encoding.mjs [--verbose]
// Exit:   0 clean, 1 violations found.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const VERBOSE = process.argv.includes('--verbose');

const BINARY = /\.(webp|png|jpe?g|gif|ico|mp4|webm|woff2?|ttf|eot|pdf|zip|lock)$/i;

// Signatures of UTF-8 bytes that were decoded as CP1252 and re-encoded. Each
// pattern is anchored on a lead byte that cannot plausibly begin a real word in
// this codebase's content, so legitimate accented text ("café", "piñon") and
// emoji stay clean.
const MOJIBAKE = [
  // E2 xx xx — em/en dash, curly quotes, bullet, ellipsis, arrows, symbols.
  { re: /â€|â€™|â€œ|â€|â‚¬|â†|âœ|â–|â—/g, what: 'â€… (E2-prefixed: dash, quote, bullet, arrow)' },
  // C2 xx — non-breaking space, degree, middot, fractions.
  { re: /Â[\s °·«»½¼¾©®±]/g, what: 'Â… (C2-prefixed: nbsp, degree, middot)' },
  // C3 xx — accented Latin letters double-encoded.
  { re: /Ã[-¿]/g, what: 'Ã… (C3-prefixed: accented letter)' },
  // F0 9F — astral-plane emoji double-encoded.
  { re: /ð/g, what: 'ð… (F0-prefixed: emoji)' },
];

const files = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 1e8 })
  .split('\n')
  .filter((f) => f && !BINARY.test(f));

const problems = [];

for (const file of files) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    continue; // deleted but still in the index — not our concern
  }

  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    problems.push({ file, kind: 'BOM', detail: 'file begins with a UTF-8 BOM (EF BB BF)' });
  }

  const text = buf.toString('utf8');
  for (const { re, what } of MOJIBAKE) {
    const hits = text.match(re);
    if (!hits) continue;
    const line = text.slice(0, text.indexOf(hits[0])).split('\n').length;
    problems.push({
      file,
      kind: 'MOJIBAKE',
      detail: `${hits.length}× ${what}, first at line ${line}`,
      sample: hits[0],
    });
  }
}

if (VERBOSE) console.log(`checked ${files.length} tracked text files`);

if (problems.length === 0) {
  console.log(`encoding check passed — ${files.length} files, no BOMs, no mojibake`);
  process.exit(0);
}

console.error(`\nENCODING CHECK FAILED — ${problems.length} problem(s)\n`);
for (const p of problems) {
  console.error(`  ${p.kind.padEnd(9)} ${p.file}`);
  console.error(`            ${p.detail}${p.sample ? `  e.g. ${JSON.stringify(p.sample)}` : ''}`);
}
console.error(
  `\nLikely cause: a tool read a UTF-8 file using the platform default encoding.\n` +
    `Re-read the file as UTF-8 and write it back as UTF-8 without a BOM. State the\n` +
    `encoding explicitly — never rely on the platform default:\n\n` +
    `  PowerShell 5.1  [IO.File]::ReadAllText($p, [Text.UTF8Encoding]::new($false))\n` +
    `                  [IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new($false))\n` +
    `  Python          open(p, encoding='utf-8', newline='')\n` +
    `  Node            fs.readFileSync(p, 'utf8')   // already correct\n`
);
process.exit(1);
