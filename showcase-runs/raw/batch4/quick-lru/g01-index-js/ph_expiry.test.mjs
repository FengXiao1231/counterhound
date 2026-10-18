import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import QuickLRU from '../../../../index.js';

const op = fc.oneof(
  fc.tuple(fc.constant('set'), fc.integer({min: 0, max: 6}), fc.integer({min: 1, max: 50}), fc.boolean()),
  fc.tuple(fc.constant('get'), fc.integer({min: 0, max: 6})),
  fc.tuple(fc.constant('tick'), fc.integer({min: 1, max: 30})),
  fc.tuple(fc.constant('resize'), fc.integer({min: 1, max: 6})),
  fc.tuple(fc.constant('evict'), fc.integer({min: 0, max: 4})),
  fc.tuple(fc.constant('delete'), fc.integer({min: 0, max: 6})),
);

test('expiry: has/peek/forEach/toString agree with entries', () => {
  fc.assert(fc.property(fc.integer({min: 1, max: 6}), fc.array(op, {maxLength: 30}), (ms, ops) => {
    const real = Date.now;
    let now = 1000;
    Date.now = () => now;
    try {
      const evs = [];
      const lru = new QuickLRU({maxSize: ms, onEviction: (k) => evs.push(k)});
      for (const [o, a, b, c] of ops) {
        if (o === 'set') lru.set(a, b, c ? {maxAge: b} : {});
        else if (o === 'get') lru.get(a);
        else if (o === 'tick') now += a;
        else if (o === 'resize') lru.resize(a);
        else if (o === 'evict') lru.evict(a);
        else lru.delete(a);
      }
      const snapshot = {};
      for (let k = 0; k <= 6; k++) snapshot[k] = [lru.peek(k), lru.has(k)];
      const ents = new Map(lru.entriesAscending());
      for (let k = 0; k <= 6; k++) {
        assert.equal(snapshot[k][1], ents.has(k));
        assert.equal(snapshot[k][0], ents.get(k));
      }
      const got = [];
      lru.forEach((v, k) => got.push([k, v]));
      assert.deepEqual(got, [...ents]);
      assert.equal(lru.toString(), `QuickLRU(${ents.size}/${lru.maxSize})`);
    } finally {
      Date.now = real;
    }
  }));
});
