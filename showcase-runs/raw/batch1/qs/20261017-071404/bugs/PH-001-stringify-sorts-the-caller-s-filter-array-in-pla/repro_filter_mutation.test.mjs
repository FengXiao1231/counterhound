import test from 'node:test';
import assert from 'node:assert/strict';
import stringify from '../../../../../lib/stringify.js';

test('repro_filter_mutation', () => {
  const filter = ['i', 'a'];
  const out = stringify({ i: 1, a: 2 }, { filter, sort: (a, b) => a.localeCompare(b) });
  assert.equal(out, 'a=2&i=1');
  assert.deepEqual(filter, ['i', 'a']);
});
