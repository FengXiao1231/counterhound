import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import bytes from '../../../../index.js';
const { format, parse } = bytes;

test('parse of integer-unit string equals n*unit', () => {
  const m = { kb: 1024, mb: 1048576, gb: 1073741824, tb: 1024 ** 4, pb: 1024 ** 5 };
  fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), fc.constantFrom(...Object.keys(m)), (n, u) => {
    assert.equal(parse(n + u), n * m[u]);
    assert.equal(parse(n + ' ' + u.toUpperCase()), n * m[u]);
  }));
});

test('parse(format(n)) with exact units roundtrips', () => {
  fc.assert(fc.property(fc.integer({ min: -1e9, max: 1e9 }), (n) => {
    const s = format(n, { decimalPlaces: 10 });
    assert.ok(Math.abs(parse(s) - n) <= 1, s);
  }));
});

test('format never yields negative zero string', () => {
  fc.assert(fc.property(fc.double({ min: -1, max: 1, noNaN: true }), (n) => {
    assert.ok(!/^-0[A-Z]/.test(format(n)) , format(n));
  }));
});

test('parse returns integer or null', () => {
  fc.assert(fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (n) => {
    assert.ok(Number.isInteger(parse(n)));
  }));
});

test('parse of plain bytes with unit b', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 1e9 }), (n) => {
    assert.equal(parse(n + 'b'), n);
    assert.equal(parse(n + ' B'), n);
  }));
});

test('format string has expected shape', () => {
  fc.assert(fc.property(fc.integer({ min: -1e15, max: 1e15 }), (n) => {
    assert.match(format(n), /^-?\d+(\.\d+)?(B|KB|MB|GB|TB|PB)$/);
  }));
});
