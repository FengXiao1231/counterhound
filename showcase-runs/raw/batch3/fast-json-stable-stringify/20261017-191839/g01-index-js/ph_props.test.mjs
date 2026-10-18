import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import index from '../../../../index.js';

const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : (v && typeof v === 'object')
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;

test('agrees with JSON.stringify of key-sorted value', () => {
  fc.assert(fc.property(fc.jsonValue(), (v) => {
    assert.equal(index(v), JSON.stringify(sortKeys(v)));
  }));
});
test('parse round trip', () => {
  fc.assert(fc.property(fc.jsonValue(), (v) => {
    assert.deepEqual(JSON.parse(index(v)), JSON.parse(JSON.stringify(v)));
  }));
});
test('key order independence', () => {
  fc.assert(fc.property(fc.dictionary(fc.string(), fc.integer()), (d) => {
    const r = Object.fromEntries(Object.entries(d).reverse());
    assert.equal(index(d), index(r));
  }));
});
test('cmp reverse', () => {
  fc.assert(fc.property(fc.dictionary(fc.string(), fc.integer()), (d) => {
    const s = index(d, (a, b) => a.key < b.key ? 1 : a.key > b.key ? -1 : 0);
    assert.deepEqual(Object.keys(JSON.parse(s)).sort().reverse(), Object.keys(JSON.parse(s)));
  }));
});
test('circular array throws TypeError or yields __cycle__', () => {
  const a = []; a.push(a);
  assert.throws(() => index(a), TypeError);
  assert.equal(index(a, { cycles: true }), '["__cycle__"]');
});
