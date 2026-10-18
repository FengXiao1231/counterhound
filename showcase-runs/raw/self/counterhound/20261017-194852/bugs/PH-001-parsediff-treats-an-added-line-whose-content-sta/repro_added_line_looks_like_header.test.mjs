import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDiff } from '../../../../../src/diff.js';

test('repro_added_line_looks_like_header', () => {
  // a.txt gains the line "++ x" at line 5; git prints it as "+++ x" inside the hunk
  const diff = [
    'diff --git a/a.txt b/a.txt',
    '--- a/a.txt',
    '+++ b/a.txt',
    '@@ -4,0 +5 @@',
    '+++ x',
    '@@ -9,0 +11 @@',
    '+y',
    '',
  ].join('\n');
  assert.deepEqual([...parseDiff(diff)], [['a.txt', [[5, 5], [11, 11]]]]);
});
