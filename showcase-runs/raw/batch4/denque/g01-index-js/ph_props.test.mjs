import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import Denque from '../../../../index.js';

const v = fc.integer({ min: 0, max: 99 });
const arr = fc.array(v, { maxLength: 40 });

test('fromArray/toArray roundtrip', () => {
  fc.assert(fc.property(arr, (a) => {
    const d = new Denque(a);
    assert.deepEqual(d.toArray(), a);
    assert.equal(d.length, a.length);
  }));
});

test('ops vs array model', () => {
  const op = fc.oneof(
    fc.tuple(fc.constant('push'), v), fc.tuple(fc.constant('unshift'), v),
    fc.tuple(fc.constant('pop')), fc.tuple(fc.constant('shift')),
    fc.tuple(fc.constant('removeOne'), fc.integer({ min: -50, max: 50 })),
    fc.tuple(fc.constant('remove'), fc.integer({ min: -50, max: 50 }), fc.integer({ min: 1, max: 20 })),
    fc.tuple(fc.constant('splice'), fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 10 }), fc.array(v, { maxLength: 5 })),
    fc.tuple(fc.constant('clear')));
  fc.assert(fc.property(arr, fc.array(op, { maxLength: 40 }), (init, ops) => {
    const d = new Denque(init); const m = init.slice();
    for (const [name, a, b, c] of ops) {
      if (name === 'push') { d.push(a); m.push(a); }
      else if (name === 'unshift') { d.unshift(a); m.unshift(a); }
      else if (name === 'pop') assert.equal(d.pop(), m.pop());
      else if (name === 'shift') assert.equal(d.shift(), m.shift());
      else if (name === 'removeOne') {
        if (m.length === 0 || a >= m.length || a < -m.length) { assert.equal(d.removeOne(a), undefined); }
        else { const i = a < 0 ? a + m.length : a; assert.equal(d.removeOne(a), m.splice(i, 1)[0]); }
      } else if (name === 'remove') {
        if (m.length === 0 || a >= m.length || a < -m.length) { assert.equal(d.remove(a, b), undefined); }
        else { const i = a < 0 ? a + m.length : a; assert.deepEqual(d.remove(a, b), m.splice(i, b)); }
      } else if (name === 'splice') {
        if (a > m.length || c.length === 0) continue;
        assert.deepEqual(d.splice(a, b, ...c), m.splice(a, b, ...c));
      } else if (name === 'clear') { d.clear(); m.length = 0; }
      assert.deepEqual(d.toArray(), m, name);
      assert.equal(d.length, m.length);
      assert.equal(d.peekBack(), m[m.length - 1]);
      assert.equal(d.peek(), m[0]);
      for (let i = -m.length; i < m.length; i++) assert.equal(d.peekAt(i), m.at(i));
    }
  }), { numRuns: 3000 });
});

test('capacity', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 10 }), fc.array(fc.tuple(fc.boolean(), v), { maxLength: 40 }), (cap, ops) => {
    const d = new Denque([], { capacity: cap }); const m = [];
    for (const [f, x] of ops) {
      if (f) { d.push(x); m.push(x); if (m.length > cap) m.shift(); }
      else { d.unshift(x); m.unshift(x); if (m.length > cap) m.pop(); }
      assert.deepEqual(d.toArray(), m);
    }
  }));
});
