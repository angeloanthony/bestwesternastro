// Tests for the generic CSV reader (M6 · T05a).
// Run: node --test scripts/report-import/parser.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readCsv } from './parser.mjs';

test('basic CSV: preserves header row and every data row verbatim', () => {
  const doc = readCsv('a,b,c\n1,2,3\n4,5,6');
  assert.deepEqual(doc.headers, ['a', 'b', 'c']);
  assert.deepEqual(doc.rows, [
    ['1', '2', '3'],
    ['4', '5', '6'],
  ]);
  assert.equal(doc.columnCount, 3);
  assert.deepEqual(doc.ragged, []);
});

test('quoted fields: embedded commas are kept inside one field', () => {
  const doc = readCsv('name,note\n"Doe, Jane","hello, world"');
  assert.deepEqual(doc.headers, ['name', 'note']);
  assert.deepEqual(doc.rows, [['Doe, Jane', 'hello, world']]);
});

test('quoted fields: embedded LF newline stays within the field', () => {
  const doc = readCsv('a,b\n"line1\nline2",x');
  assert.deepEqual(doc.rows, [['line1\nline2', 'x']]);
});

test('quoted fields: embedded CRLF is preserved verbatim', () => {
  const doc = readCsv('a,b\n"x\r\ny",z');
  assert.deepEqual(doc.rows, [['x\r\ny', 'z']]);
});

test('quoted fields: escaped double-quotes ("") collapse to one quote', () => {
  const doc = readCsv('a\n"she said ""hi"""');
  assert.deepEqual(doc.rows, [['she said "hi"']]);
});

test('BOM: a leading UTF-8 BOM is stripped from the first header', () => {
  const doc = readCsv('﻿a,b\n1,2');
  assert.deepEqual(doc.headers, ['a', 'b']); // not '﻿a'
  assert.deepEqual(doc.rows, [['1', '2']]);
});

test('CRLF line endings: records split correctly', () => {
  const doc = readCsv('a,b\r\n1,2\r\n3,4');
  assert.deepEqual(doc.headers, ['a', 'b']);
  assert.deepEqual(doc.rows, [
    ['1', '2'],
    ['3', '4'],
  ]);
});

test('trailing newline does not produce an empty trailing row', () => {
  const doc = readCsv('a,b\n1,2\n');
  assert.deepEqual(doc.rows, [['1', '2']]);
});

test('blank lines between records are skipped', () => {
  const doc = readCsv('a,b\n1,2\n\n3,4\n');
  assert.deepEqual(doc.rows, [
    ['1', '2'],
    ['3', '4'],
  ]);
  assert.deepEqual(doc.ragged, []);
});

test('ragged rows are flagged, not rejected', () => {
  const doc = readCsv('a,b,c\n1,2\n4,5,6\n7,8,9,10');
  // Every row is still returned...
  assert.deepEqual(doc.rows, [
    ['1', '2'],
    ['4', '5', '6'],
    ['7', '8', '9', '10'],
  ]);
  // ...and the too-short and too-long ones are flagged by index + width.
  assert.deepEqual(doc.ragged, [
    { row: 0, columns: 2 },
    { row: 2, columns: 4 },
  ]);
});

test('empty input yields empty headers and rows (no throw)', () => {
  const doc = readCsv('');
  assert.deepEqual(doc.headers, []);
  assert.deepEqual(doc.rows, []);
  assert.equal(doc.columnCount, 0);
  assert.deepEqual(doc.ragged, []);
});

test('empty quoted field and empty unquoted field are distinct-safe (both empty string)', () => {
  const doc = readCsv('a,b,c\n1,"",3\n4,,6');
  assert.deepEqual(doc.rows, [
    ['1', '', '3'],
    ['4', '', '6'],
  ]);
});

test('non-string input throws TypeError', () => {
  assert.throws(() => readCsv(null), TypeError);
  assert.throws(() => readCsv(Buffer.from('a,b')), TypeError);
});
