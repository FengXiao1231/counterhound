<!-- counterhound-report -->
### counterhound found 1 provable bug

Checked 8 functions in 1 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> LRUCache.load() overwrites `start` on the caller's entry objects, so reloading the same dump gives wrong TTLs <sub>(wrong result, src/index.ts)</sub></summary>

| | |
|---|---|
| Function | `LRUCache.load` |
| Input | a=new LRUCache({max:5,ttl:100000}); a.set(1,'x'); d=a.dump(); new LRUCache({max:5,ttl:100000}).load(d); then inspect d[0][1].start / load d into another cache |
| Expected | d is unchanged after load (start stays the portable Date.now() timestamp), so a second load restores the intended remaining TTL |
| Actual | load assigns entry.start = perf.now() - age on the caller's entry object, replacing the portable timestamp (e.g. 1792297393352 becomes 220.9). A later load of t |
| Review | low severity, confidence 0.80 |

In `src/index.ts`, `load()` runs `entry.start = this.#perf.now() - age` on the entry objects the caller passed in. That replaces the portable `Date.now()` timestamp with a `performance.now()`-relative value. `load()` documents `start` as a portable `Date.now()` timestamp and `dump()` produces exactly that format. A second `load()` of the same array therefore computes a huge age (about 1.79e12 ms), and the entry comes out immediately stale. The input is valid, the repro is deterministic, and it is not a float artefact. The fix is small, for example building a copy of the entry with the adjusted

Failing test (`repro_load_mutates_input.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache } from '../../../../../src/index.ts';

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
```
</details>

<sub>56s · $0.24 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
