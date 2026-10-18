import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExponent } from '../../../../src/helpers.js';

test('repro_log_boundary', () => {
  // 999999999999999 < 10^15 so it is in the TB range (exponent 4)
  assert.equal(calculateExponent(999999999999999, -1, -1, true, 0).e, 4);
});
