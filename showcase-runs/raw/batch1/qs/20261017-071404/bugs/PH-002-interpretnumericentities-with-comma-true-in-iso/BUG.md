# interpretNumericEntities with comma:true in iso-8859-1 flattens the parsed array back into a comma-joined string

| | |
|---|---|
| Function | `parse (lib/parse.js module.exports)` in `lib/parse.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.72, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** parse('a=b,c', { comma: true, charset: 'iso-8859-1', interpretNumericEntities: true })

**Expected:** { a: ['b', 'c'] }

**Actual:** { a: 'b,c' }

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import parse from '../../../../../lib/parse.js';

test('repro_comma_numeric_entities', () => {
  assert.deepEqual(
    parse('a=b,c', { comma: true, charset: 'iso-8859-1', interpretNumericEntities: true }),
    { a: ['b', 'c'] }
  );
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

## Why this is a bug

parseValues splits the value into an array via parseArrayValue (comma:true), then `val = interpretNumericEntities(String(val))` at lib/parse.js:191 stringifies the array with Array#toString, rejoining it with ',' and returning a string. The README documents comma:true as parsing comma-separated values into arrays; without interpretNumericEntities the same input yields ['b','c'].

Independent review: In lib/parse.js, `interpretNumericEntities(String(val))` runs on the array that `parseArrayValue` returns for comma:true. `String()` joins it with ',' and the result is a string, so `a=b,c` gives 'b,c' instead of ['b','c']. This is the only comma:true case where an option that should only rewrite values changes the result's shape, and the README promises arrays. One weakness: the existing test at test/parse.js:1292 asserts the joined output (`a[]=1,☺` gives `['1,☺']`). That test is titled 'does not crash', so it looks like it locked in the accident, but a fix would have to update it.

## How it was found

Property: *with comma:true, 'a=b,c' parses to {a:['b','c']} regardless of whether interpretNumericEntities/charset are also set (the entity pass only rewrites values, it must not change their shape)*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
