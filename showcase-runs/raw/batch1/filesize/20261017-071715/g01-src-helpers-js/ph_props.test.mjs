import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  formatOutput, getBaseConfiguration, applyRounding, calculateBigIntExponent,
  calculateExponent, resolveSymbol,
} from '../../../../src/helpers.js';

test('exact powers give exact exponent (decimal)', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 8 }), (k) => {
    const n = Math.pow(10, 3 * k);
    assert.equal(calculateExponent(n, -1, -1, true, 0).e, k);
    assert.equal(calculateExponent(n - 1 > 0 ? n - 1 : 0, -1, -1, true, 0).e, Math.max(k - 1, 0));
  }));
});

test('exact powers give exact exponent (binary)', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 8 }), (k) => {
    const n = Math.pow(1024, k);
    assert.equal(calculateExponent(n, -1, -1, false, 0).e, k);
  }));
});

test('bigint and number exponent agree', () => {
  fc.assert(fc.property(fc.bigInt({ min: 0n, max: 10n ** 27n }), fc.boolean(), (n, dec) => {
    const a = calculateBigIntExponent(n, -1, -1, dec, 0).e;
    const b = calculateExponent(Number(n), -1, -1, dec, 0).e;
    assert.equal(a, b);
  }));
});

test('base config for unknown standard falls back by base', () => {
  fc.assert(fc.property(fc.string(), fc.constantFrom(-1, 2, 10), (s, base) => {
    fc.pre(!['si', 'iec', 'jedec'].includes(s));
    const c = getBaseConfiguration(s, base);
    assert.equal(c.ceil, base === 2 ? 1024 : 1000);
  }));
  for (const s of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(getBaseConfiguration(s, -1).ceil, 1000, s);
  }
});

test('applyRounding auto increment', () => {
  fc.assert(fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 0, max: 4 }), fc.constantFrom(Math.round, Math.floor, Math.ceil),
    (val, e, round, f) => {
      const r = applyRounding(val, 1000, e, round, f, true);
      assert.ok(r.e === e || r.e === e + 1);
      if (r.e === e + 1) assert.equal(r.value, 1);
      const r2 = applyRounding(val, 1000, e, round, f, false);
      assert.equal(r2.e, e);
    }));
});

test('resolveSymbol', () => {
  fc.assert(fc.property(fc.constantFrom('iec', 'jedec'), fc.boolean(), fc.integer({ min: 0, max: 8 }), fc.boolean(),
    (s, bits, e, dec) => {
      const r = resolveSymbol(s, bits, e, dec);
      assert.equal(typeof r, 'string');
      if (dec && e === 1) assert.equal(r, bits ? 'kbit' : 'kB');
    }));
});

test('formatOutput', () => {
  fc.assert(fc.property(fc.string(), fc.string(), fc.string(), fc.integer({ min: 0, max: 8 }),
    (v, sym, spacer, e) => {
      const arr = [v, sym];
      assert.equal(formatOutput(arr, e, sym, 'string', spacer), v + spacer + sym);
      assert.deepEqual(formatOutput(arr, e, sym, 'object', spacer), { value: v, symbol: sym, exponent: e, unit: sym });
      assert.equal(formatOutput(arr, e, sym, 'array', spacer), arr);
    }));
});
