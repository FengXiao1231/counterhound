import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom } from '../../../../src/utils/random.ts';

test('repro_empty_seed', () => {
  const a = seededRandom('');
  const b = seededRandom('');
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
