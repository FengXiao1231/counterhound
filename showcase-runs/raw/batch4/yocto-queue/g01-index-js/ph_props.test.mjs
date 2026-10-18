import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import Queue from '../../../../index.js';

const val = fc.oneof(fc.integer(), fc.string(), fc.constant(undefined), fc.constant(null), fc.anything());
const op = fc.oneof(
  fc.tuple(fc.constant('enq'), val), fc.constant(['deq']), fc.constant(['peek']),
  fc.constant(['clear']), fc.constant(['drain']), fc.constant(['iter']), fc.tuple(fc.constant('drainPartial'), fc.nat(5)));

test('model', () => {
  fc.assert(fc.property(fc.array(op, { maxLength: 60 }), (ops) => {
    const q = new Queue(); let m = [];
    for (const [k, a] of ops) {
      if (k === 'enq') { q.enqueue(a); m.push(a); }
      else if (k === 'deq') assert.deepEqual(q.dequeue(), m.shift());
      else if (k === 'peek') assert.deepEqual(q.peek(), m[0]);
      else if (k === 'clear') { q.clear(); m = []; }
      else if (k === 'drain') { assert.deepEqual([...q.drain()], m); m = []; }
      else if (k === 'drainPartial') { const it = q.drain(); for (let i = 0; i < a; i++) { const r = it.next(); assert.equal(r.done, m.length === 0); if (!r.done) assert.deepEqual(r.value, m.shift()); } }
      else assert.deepEqual([...q], m);
      assert.equal(q.size, m.length);
      assert.deepEqual([...q], m);
    }
  }));
});

test('enqueue after emptying', () => {
  fc.assert(fc.property(fc.array(fc.integer()), fc.array(fc.integer()), (a, b) => {
    const q = new Queue(); a.forEach((x) => q.enqueue(x)); [...q.drain()]; b.forEach((x) => q.enqueue(x));
    assert.deepEqual([...q], b);
  }));
});
