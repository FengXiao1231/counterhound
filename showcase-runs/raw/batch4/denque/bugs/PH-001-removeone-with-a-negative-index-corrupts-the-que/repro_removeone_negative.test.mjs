import test from 'node:test';
import assert from 'node:assert/strict';
import Denque from '../../../../../index.js';

test('repro_removeone_negative', () => {
  const d = new Denque([1, 2]);
  assert.equal(d.removeOne(-1), 2);
  assert.deepEqual(d.toArray(), [1]);
});
