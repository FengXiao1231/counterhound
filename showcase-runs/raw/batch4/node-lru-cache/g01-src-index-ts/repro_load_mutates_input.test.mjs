import test from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache } from '../../../../src/index.ts';

test('repro_load_mutates_input: loading the same dump twice keeps entries alive', () => {
  const a = new LRUCache({ max: 5, ttl: 100000 });
  a.set(1, 'x');
  const d = a.dump();
  const startBefore = d[0][1].start;
  const b = new LRUCache({ max: 5, ttl: 100000 });
  b.load(d);
  assert.equal(d[0][1].start, startBefore, 'load() must not mutate its argument');
  const c = new LRUCache({ max: 5, ttl: 100000 });
  c.load(d);
  assert.equal(c.get(1), 'x');
});
