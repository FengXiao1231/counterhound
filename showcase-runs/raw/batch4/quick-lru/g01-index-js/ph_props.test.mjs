import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import QuickLRU from '../../../../index.js';

const op = fc.oneof(
  fc.tuple(fc.constant('set'), fc.integer({min: 0, max: 8}), fc.integer()),
  fc.tuple(fc.constant('get'), fc.integer({min: 0, max: 8})),
  fc.tuple(fc.constant('peek'), fc.integer({min: 0, max: 8})),
  fc.tuple(fc.constant('has'), fc.integer({min: 0, max: 8})),
  fc.tuple(fc.constant('delete'), fc.integer({min: 0, max: 8})),
  fc.tuple(fc.constant('resize'), fc.integer({min: 1, max: 8})),
  fc.tuple(fc.constant('evict'), fc.integer({min: 0, max: 5})),
);

function build(maxSize, ops, evs) {
  const lru = new QuickLRU({maxSize, onEviction: (k, v) => evs.push([k, v])});
  for (const [o, a, b] of ops) {
    if (o === 'set') lru.set(a, b);
    else if (o === 'get') lru.get(a);
    else if (o === 'delete') lru.delete(a);
    else if (o === 'resize') lru.resize(a);
    else if (o === 'evict') lru.evict(a);
    else if (o === 'peek') lru.peek(a);
    else lru.has(a);
  }
  return lru;
}

test('resize keeps newest items and emits evictions for dropped', () => {
  fc.assert(fc.property(fc.integer({min: 1, max: 8}), fc.array(op, {maxLength: 30}), fc.integer({min: 1, max: 8}), (ms, ops, ns) => {
    const evs = [];
    const lru = build(ms, ops, evs);
    const before = [...lru.entriesAscending()];
    evs.length = 0;
    lru.resize(ns);
    const after = [...lru.entriesAscending()];
    assert.equal(lru.maxSize, ns);
    assert.equal(lru.size, after.length);
    const keep = before.slice(Math.max(0, before.length - ns));
    assert.deepEqual(after, keep);
    assert.deepEqual(evs, before.slice(0, before.length - keep.length));
  }));
});

test('has/peek agree with entries and do not change order', () => {
  fc.assert(fc.property(fc.integer({min: 1, max: 8}), fc.array(op, {maxLength: 30}), (ms, ops) => {
    const lru = build(ms, ops, []);
    const before = [...lru.entriesAscending()];
    const m = new Map(before);
    for (let k = 0; k <= 8; k++) {
      assert.equal(lru.has(k), m.has(k));
      assert.equal(lru.peek(k), m.get(k));
    }
    assert.deepEqual([...lru.entriesAscending()], before);
  }));
});

test('evict removes oldest, keeps at least one', () => {
  fc.assert(fc.property(fc.integer({min: 1, max: 8}), fc.array(op, {maxLength: 30}), fc.integer({min: 0, max: 12}), (ms, ops, n) => {
    const evs = [];
    const lru = build(ms, ops, evs);
    const before = [...lru.entriesAscending()];
    evs.length = 0;
    lru.evict(n);
    const cnt = before.length === 0 ? 0 : Math.min(n, before.length - 1);
    assert.deepEqual([...lru.entriesAscending()], before.slice(cnt));
    assert.deepEqual(evs, before.slice(0, cnt));
    assert.equal(lru.size, before.length - cnt);
  }));
});

test('forEach and toString', () => {
  fc.assert(fc.property(fc.integer({min: 1, max: 8}), fc.array(op, {maxLength: 30}), (ms, ops) => {
    const lru = build(ms, ops, []);
    const exp = [...lru.entriesAscending()];
    const got = [];
    const self = {};
    lru.forEach(function (v, k, m) {
      assert.equal(this, self);
      assert.equal(m, lru);
      got.push([k, v]);
    }, self);
    assert.deepEqual(got, exp);
    lru.forEach(function () {
      assert.equal(this, lru);
    });
    assert.equal(lru.toString(), `QuickLRU(${exp.length}/${lru.maxSize})`);
  }));
});

test('set works after any op sequence', () => {
  fc.assert(fc.property(fc.integer({min: 1, max: 8}), fc.array(op, {maxLength: 40}), (ms, ops) => {
    const lru = build(ms, ops, []);
    assert.ok(lru.size <= lru.maxSize);
    lru.set(100, 1);
    assert.equal(lru.get(100), 1);
    assert.ok([...lru.keys()].length <= 2 * lru.maxSize);
  }));
});
