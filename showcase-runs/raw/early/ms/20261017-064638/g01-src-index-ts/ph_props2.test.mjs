import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { format } from '../../../../src/index.ts';

const units = [1000, 60000, 3600000, 86400000, 604800000];
test('format sign symmetry at half boundaries', () => {
  fc.assert(fc.property(fc.constantFrom(...units), fc.integer({min:1,max:50}), fc.boolean(), (u, k, long) => {
    const n = u * k + u / 2;
    assert.equal(format(-n, { long }), '-' + format(n, { long }));
  }));
});
