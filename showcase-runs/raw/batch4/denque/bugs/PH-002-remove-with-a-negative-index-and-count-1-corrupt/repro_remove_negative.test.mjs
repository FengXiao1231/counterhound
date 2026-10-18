import test from 'node:test';
import assert from 'node:assert/strict';
import Denque from '../../../../../index.js';

test('repro_remove_negative', () => {
  const d = new Denque([1, 2, 3, 4]);
  assert.deepEqual(d.remove(-3, 2), [2, 3]);
  assert.deepEqual(d.toArray(), [1, 4]);
});
