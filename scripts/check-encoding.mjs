// Encoding guard - fails the build on UTF-8 BOMs and mojibake in tracked text files.
//
// WHY THIS EXISTS
// On 2026-08-04, commit 60a7552 corrupted five page files. A find-and-replace
// read them with the platform default encoding instead of UTF-8: on Windows
// that is the ANSI code page (CP1252), so an em dash (bytes E2 80 94) decoded
// to three stray characters, and the files were written back as UTF-8 *with a
// BOM*. 212 corrupted sequences reached the built HTML, including JSON-LD that
// Google parses.
//
// Nothing caught it. Prettier, ESLint and `astro build` all passed: the bytes
// are valid UTF-8, the characters are simply wrong. Static analysis cannot tell
// an em dash from its mangled form. Only a byte-level check can.
//
// THE RULE THIS ENFORCES
// Any tool that reads or writes text in this repo must state UTF-8 explicitly
// rather than inherit a platform default. That applies to PowerShell, Python,
// Node, and editors alike - the platform default is the bug, not any one tool.
//
// KEEP THIS FILE FREE OF LITERAL MOJIBAKE.
// The guard scans every tracked text file, including itself. Patterns are built
// from character codes rather than written as literals so that this source has
// nothing for its own check to flag. Writing an example of the corruption into
// a comment here would fail CI. (It did - see the commit that added this note.)
//
// Usage:  node scripts/check-encoding.mjs [--verbose]
// Exit:   0 clean, 1 violations found.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const VERBOSE = process.argv.includes('--verbose');

const BINARY = /\.(webp|png|jpe?g|gif|ico|mp4|webm|woff2?|ttf|eot|pdf|zip|lock)$/i;

// CP1252 renderings of bytes 0x80-0x9F. Everything outside that band is
// identical to Latin-1, so those bytes render as the same code point.
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x008d, 0x017d, 0x008f, 0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

const esc = (cp) => '\\u' + cp.toString(16).padStart(4, '0');

// A UTF-8 continuation byte is 0x80-0xBF. Decoded as CP1252 it becomes one of
// these characters. Their presence immediately after a lead character is the
// signature of a UTF-8 sequence that was read as CP1252.
const CONTINUATION = [
  ...CP1252_HIGH,
  ...Array.from({ length: 0xbf - 0xa0 + 1 }, (_, i) => 0xa0 + i),
].map(esc);

// UTF-8 lead bytes, decoded as CP1252. C2/C3 begin 2-byte sequences (accents,
// nbsp, degree), E2 begins the 3-byte punctuation block (dashes, curly quotes,
// bullets, arrows), F0 begins 4-byte astral-plane emoji.
const LEADS = [
  { cp: 0x00c2, label: 'C2-prefixed (nbsp, degree, middot, fractions)' },
  { cp: 0x00c3, label: 'C3-prefixed (accented Latin letter)' },
  { cp: 0x00e2, label: 'E2-prefixed (dash, curly quote, bullet, arrow)' },
  { cp: 0x00f0, label: 'F0-prefixed (emoji)' },
];

const MOJIBAKE = LEADS.map(({ cp, label }) => ({
  re: new RegExp(esc(cp) + '[' + CONTINUATION.join('') + ']', 'g'),
  what: label,
}));

const files = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 1e8 })
  .split('\n')
  .filter((f) => f && !BINARY.test(f));

const problems = [];

for (const file of files) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    continue; // deleted but still in the index - not our concern
  }

  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    problems.push({ file, kind: 'BOM', detail: 'file begins with a UTF-8 BOM (EF BB BF)' });
  }

  const text = buf.toString('utf8');
  for (const { re, what } of MOJIBAKE) {
    const hits = text.match(re);
    if (!hits) continue;
    const line = text.slice(0, text.indexOf(hits[0])).split('\n').length;
    const codes = [...hits[0]]
      .map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase())
      .join(' ');
    problems.push({
      file,
      kind: 'MOJIBAKE',
      detail: `${hits.length}x ${what}, first at line ${line} (${codes})`,
    });
  }
}

if (VERBOSE) console.log(`checked ${files.length} tracked text files`);

if (problems.length === 0) {
  console.log(`encoding check passed - ${files.length} files, no BOMs, no mojibake`);
  process.exit(0);
}

console.error(`\nENCODING CHECK FAILED - ${problems.length} problem(s)\n`);
for (const p of problems) {
  console.error(`  ${p.kind.padEnd(9)} ${p.file}`);
  console.error(`            ${p.detail}`);
}
console.error(
  `\nLikely cause: a tool read a UTF-8 file using the platform default encoding.\n` +
    `Re-read the file as UTF-8 and write it back as UTF-8 without a BOM. State the\n` +
    `encoding explicitly - never rely on the platform default:\n\n` +
    `  PowerShell 5.1  [IO.File]::ReadAllText($p, [Text.UTF8Encoding]::new($false))\n` +
    `                  [IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new($false))\n` +
    `  Python          open(p, encoding='utf-8', newline='')\n` +
    `  Node            fs.readFileSync(p, 'utf8')   // already correct\n`
);
process.exit(1);
