import test from 'node:test';
import assert from 'node:assert/strict';
import { getBaseConfiguration } from '../../../../src/helpers.js';

test('repro_proto_standard', () => {
  assert.deepEqual(getBaseConfiguration('constructor', -1), { isDecimal: true, ceil: 1000, actualStandard: 'jedec' });
});
