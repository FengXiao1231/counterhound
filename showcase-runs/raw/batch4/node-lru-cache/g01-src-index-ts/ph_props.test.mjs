import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { LRUCache } from '../../../../src/index.ts';

const key = fc.integer({ min: 0, max: 6 });
const val = fc.integer({ min: 0, max: 100 });
const z = fc.constant(0);
const op = fc.oneof(
  fc.tuple(fc.constant('set'), key, val),
  fc.tuple(fc.constant('get'), key, z),
  fc.tuple(fc.constant('del'), key, z),
  fc.tuple(fc.constant('pop'), z, z),
  fc.tuple(fc.constant('peek'), key, z),
  fc.tuple(fc.constant('has'), key, z),
  fc.tuple(fc.constant('dumpload'), z, z),
);

function run(mk, ops) {
  const max = 4;
  const c = mk(max);
  let m = []; // LRU first -> MRU last
  const touch = (k, v) => { m = m.filter(e => e[0] !== k); m.push([k, v]); };
  for (const [o, k, v] of ops) {
    if (o === 'set') { c.set(k, v); touch(k, v); if (m.length > max) m.shift(); }
    else if (o === 'get') { const r = c.get(k); const e = m.find(e => e[0] === k); assert.equal(r, e?.[1]); if (e) touch(k, e[1]); }
    else if (o === 'del') { const r = c.delete(k); assert.equal(r, m.some(e => e[0] === k)); m = m.filter(e => e[0] !== k); }
    else if (o === 'pop') { const r = c.pop(); const e = m.shift(); assert.equal(r, e?.[1]); }
    else if (o === 'peek') { assert.equal(c.peek(k), m.find(e => e[0] === k)?.[1]); }
    else if (o === 'has') { assert.equal(c.has(k), m.some(e => e[0] === k)); }
    else if (o === 'dumpload') { const d = c.dump(); c.load(d); }
    assert.equal(c.size, m.length);
    assert.deepEqual([...c.rkeys()], m.map(e => e[0]));
    assert.deepEqual([...c.keys()], m.map(e => e[0]).reverse());
    assert.deepEqual([...c.values()], m.map(e => e[1]).reverse());
    assert.deepEqual(c.dump().map(([k, e]) => [k, e.value]), m);
  }
}
test('plain model', () => { fc.assert(fc.property(fc.array(op, { maxLength: 40 }), ops => run(max => new LRUCache({ max }), ops))); });
test('ttl model', () => { fc.assert(fc.property(fc.array(op, { maxLength: 40 }), ops => run(max => new LRUCache({ max, ttl: 100000 }), ops))); });
test('size model roundtrip', () => {
  fc.assert(fc.property(fc.array(fc.tuple(key, val, fc.integer({ min: 1, max: 3 })), { maxLength: 15 }), sets => {
    const mk = () => new LRUCache({ max: 5, maxSize: 8, ttl: 100000, sizeCalculation: () => 1 });
    const a = mk();
    for (const [k, v, s] of sets) a.set(k, v, { size: s });
    const b = mk(); b.load(a.dump());
    assert.deepEqual([...b.keys()], [...a.keys()]);
    assert.equal(b.calculatedSize, a.calculatedSize);
    assert.deepEqual(b.dump().map(x => [x[0], x[1].value, x[1].size]), a.dump().map(x => [x[0], x[1].value, x[1].size]));
  }));
});
test('load does not mutate input', () => {
  const a = new LRUCache({ max: 5, ttl: 100000 });
  a.set(1, 1);
  const d = a.dump(); const copy = JSON.stringify(d);
  new LRUCache({ max: 5, ttl: 100000 }).load(d);
  assert.equal(JSON.stringify(d), copy);
});
