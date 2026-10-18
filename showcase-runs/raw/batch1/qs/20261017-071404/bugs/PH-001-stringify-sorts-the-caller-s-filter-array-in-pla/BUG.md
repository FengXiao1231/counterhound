# stringify() sorts the caller's filter array in place when a sort option is supplied

| | |
|---|---|
| Function | `stringify (lib/stringify.js module.exports)` in `lib/stringify.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.75, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** stringify({i:1,a:2}, {filter:['i','a'], sort:(a,b)=>a.localeCompare(b)})

**Expected:** Output 'a=2&i=1' and the caller's filter array remains ['i','a']

**Actual:** Output is sorted, but filter is mutated to ['a','i'] (objKeys = filter; objKeys.sort(...))

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import stringify from '../../../../../lib/stringify.js';

test('repro_filter_mutation', () => {
  const filter = ['i', 'a'];
  const out = stringify({ i: 1, a: 2 }, { filter, sort: (a, b) => a.localeCompare(b) });
  assert.equal(out, 'a=2&i=1');
  assert.deepEqual(filter, ['i', 'a']);
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

## Why this is a bug

Top-level code does `objKeys = filter; ... objKeys.sort(options.sort)`, sorting the user's array. Inner recursion sorts a fresh Object.keys copy, so only the filter path leaks the mutation; a serializer is expected not to modify its options, and reusing one filter array across calls is the documented usage.

Independent review: In lib/stringify.js, module.exports sets `objKeys = filter` (the caller's array) and then calls `objKeys.sort(options.sort)`. This reorders the array the caller passed in. The recursive path avoids this because it sorts a fresh `Object.keys` copy. The README documents `filter` as a reusable list of keys and never says it may be reordered, and a serializer silently mutating its options is a surprising side effect. The repro is correct and fails consistently, and the fix is trivial: use `filter.slice()` or copy before sorting. A maintainer would likely accept it, but it is a minor edge case with no documented guarantee, which is why the severity is low.

## How it was found

Property: *stringify does not mutate its input options (the filter array) when sort is supplied*.

fast-check shrank the failure to: `Counterexample: [["b","a"]]`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
