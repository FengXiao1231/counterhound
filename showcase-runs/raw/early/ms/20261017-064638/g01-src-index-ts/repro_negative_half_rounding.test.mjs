import test from 'node:test';
import assert from 'node:assert/strict';
import { format } from '../../../../src/index.ts';

test('repro_negative_half_rounding', () => {
  assert.equal(format(1500), '2s');
  assert.equal(format(-1500), '-2s');
  assert.equal(format(-1500, { long: true }), '-2 seconds');
});
