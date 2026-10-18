import test from 'node:test';
import assert from 'node:assert/strict';
import parse from '../../../../index.js';

test('repro_negative_after_noise', () => {
  assert.equal(parse('duration: -1h'), -3600000);
});
