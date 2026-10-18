import test from 'node:test';
import assert from 'node:assert/strict';
import { filesize } from '../../../../src/filesize.js';
test('p', () => {
  assert.equal(filesize(999999999999999, { round: 6 }), 'x');
});
test('q', () => {
  assert.equal(filesize(999999999999999, { exponent: 4, round: 6 }), 'x');
});
