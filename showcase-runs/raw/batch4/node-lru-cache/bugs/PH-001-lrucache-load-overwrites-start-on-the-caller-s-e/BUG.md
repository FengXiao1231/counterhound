# LRUCache.load() overwrites `start` on the caller's entry objects, so reloading the same dump gives wrong TTLs

| | |
|---|---|
| Function | `LRUCache.load` in `src/index.ts` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** a=new LRUCache({max:5,ttl:100000}); a.set(1,'x'); d=a.dump(); new LRUCache({max:5,ttl:100000}).load(d); then inspect d[0][1].start / load d into another cache

**Expected:** d is unchanged after load (start stays the portable Date.now() timestamp), so a second load restores the intended remaining TTL

**Actual:** load assigns entry.start = perf.now() - age on the caller's entry object, replacing the portable timestamp (e.g. 1792297393352 becomes 220.9). A later load of the same array treats it as a Date.now() timestamp, computes a huge age, and the entry is immediately stale.

## Reproduce

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

Fails with `AssertionError: load() must not mutate its argument`

Run it with `node --test repro_load_mutates_input.test.mjs` (fix the import path if you move it).

## Why this is a bug

dump() docs say its output 'can be passed to load'; load's doc says start fields 'are assumed to be calculated relative to a portable Date.now() timestamp'. After load the array violates that assumption. Mutating an input argument is also unexpected for a load/restore API.

Independent review: In `src/index.ts`, `load()` runs `entry.start = this.#perf.now() - age` on the entry objects the caller passed in. That replaces the portable `Date.now()` timestamp with a `performance.now()`-relative value. `load()` documents `start` as a portable `Date.now()` timestamp and `dump()` produces exactly that format. A second `load()` of the same array therefore computes a huge age (about 1.79e12 ms), and the entry comes out immediately stale. The input is valid, the repro is deterministic, and it is not a float artefact. The fix is small, for example building a copy of the entry with the adjusted `start` before calling `#set`. The impact is narrow, because it only affects someone who reuses a dump array, so it is a low-severity but legitimate bug.

## How it was found

Property: *load(arr) does not modify arr; the same dump can be loaded into several caches with the same result*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
