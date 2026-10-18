import test from 'node:test';
import assert from 'node:assert/strict';
import index from '../../../../../index.js';

test('repro_array_cycle', () => {
  const a = []; a.push(a);
  assert.throws(() => index(a), TypeError);
  assert.equal(index(a, { cycles: true }), '["__cycle__"]');
});
