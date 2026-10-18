# extractJSON prefers '{' over '[' regardless of position, so an array of objects in prose returns its first element

| | |
|---|---|
| Function | `extractJSON` in `src/util.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** Result: [{"a":1},{"b":2}]

**Expected:** [{a:1},{b:2}]

**Actual:** {a:1} (the first object; '{' is searched before '[' regardless of position)

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJSON } from '../../../../../src/util.js';
test('repro_extractjson_array_of_objects', () => {
  assert.deepEqual(extractJSON('Result: [{"a":1},{"b":2}]'), [{ a: 1 }, { b: 2 }]);
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

Run it with `node --test repro_extractjson_array_of_objects.test.mjs` (fix the import path if you move it).

## Why this is a bug

Docstring: 'Find the first JSON object/array in text'. The array starts before the object, so it is first; an array of objects is a common agent output.

Independent review: The docstring promises the first JSON object/array in the text. The loop in src/util.js:130 tries '{' before '[' without comparing positions. For `Result: [{"a":1},{"b":2}]`, whole-text parsing fails, the '{' pass then parses the first inner object, and the enclosing array is silently truncated. The existing tests don't catch this: the fenced array case succeeds through the direct JSON.parse of the fence contents, and the prose case only uses an object. A fix is trivial (try whichever opener comes first, falling back to the other), so a maintainer would accept it. Impact is limited because the current callers mostly expect objects.

## How it was found

Property: *a JSON value embedded in prose is extracted intact*.

fast-check shrank the failure to: `Counterexample: [[{}]]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
