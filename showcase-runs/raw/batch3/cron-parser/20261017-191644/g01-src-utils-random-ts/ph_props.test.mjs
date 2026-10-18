import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { seededRandom } from '../../../../src/utils/random.ts';

const take = (g, n) => Array.from({ length: n }, () => g());

test('same seed gives same sequence', () => {
  fc.assert(fc.property(fc.string({ minLength: 1 }), (s) => {
    assert.deepEqual(take(seededRandom(s), 20), take(seededRandom(s), 20));
  }));
});

test('same unicode seed gives same sequence', () => {
  fc.assert(fc.property(fc.string({ unit: 'binary', minLength: 1 }), (s) => {
    assert.deepEqual(take(seededRandom(s), 20), take(seededRandom(s), 20));
  }));
});

test('outputs in [0,1)', () => {
  fc.assert(fc.property(fc.option(fc.string(), { nil: undefined }), (s) => {
    for (const v of take(seededRandom(s), 200)) {
      assert.ok(typeof v === 'number' && v >= 0 && v < 1);
    }
  }));
});

test('empty string seed is deterministic', () => {
  assert.deepEqual(take(seededRandom(''), 10), take(seededRandom(''), 10));
});

test('unseeded generators differ', () => {
  assert.notDeepEqual(take(seededRandom(), 5), take(seededRandom(), 5));
});

test('distinct seeds mostly give distinct sequences', () => {
  fc.assert(fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (a, b) => {
    fc.pre(a !== b);
    fc.pre(take(seededRandom(a), 1)[0] !== take(seededRandom(b), 1)[0] || true);
    assert.notDeepEqual(take(seededRandom(a), 5), take(seededRandom(b), 5));
  }), { numRuns: 500 });
});
