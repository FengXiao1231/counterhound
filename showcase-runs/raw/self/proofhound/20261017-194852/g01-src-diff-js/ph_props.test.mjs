import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parseDiff } from '../../../../src/diff.js';

test('prop_added_content_line_not_mistaken_for_file_header', () => {
  fc.assert(fc.property(
    fc.stringMatching(/^[a-z ]{0,8}$/), fc.integer({ min: 1, max: 500 }),
    (rest, start) => {
      const diff = `--- a/f.txt\n+++ b/f.txt\n@@ -1,0 +${start} @@\n+++ ${rest}\n`;
      const m = parseDiff(diff);
      assert.deepEqual([...m.keys()], ['f.txt']);
      assert.deepEqual(m.get('f.txt'), [[start, start]]);
    }));
});
