# parseLibtest drops #[should_panic] tests (failures go unreported)

| | |
|---|---|
| Function | `parseLibtest` in `src/lang/rust.js` |
| Kind | Wrong result |
| Review | unclear, confidence 0.00, severity undefined |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** running 1 test
test tests::it_panics - should panic ... FAILED

failures:

---- tests::it_panics stdout ----
note: test did not panic as expected

failures:
    tests::it_panics


**Expected:** one test, outcome 'failed'

**Actual:** empty list: the line is not matched, so the failure is silently lost

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLibtest } from '../../../../../../src/lang/rust.js';

test('repro_should_panic', () => {
  const out = `running 1 test
test tests::it_panics - should panic ... FAILED

failures:

---- tests::it_panics stdout ----
note: test did not panic as expected

failures:
    tests::it_panics

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out
`;
  const got = parseLibtest(out, undefined);
  assert.equal(got.length, 1);
  assert.equal(got[0].outcome, 'failed');
});
```

Fails with `AssertionError: Expected values to be strictly equal:`

Run it with `node --test repro_should_panic.test.mjs` (fix the import path if you move it).

## Why this is a bug

libtest's pretty format prints '<name> - should panic' for #[should_panic] tests; the line regex /^test (\S+) \.\.\. / requires a single non-space token before '...'. The function is the parser of cargo test output used by rust.runTests.

Independent review: not reviewed: budget reached

## How it was found

Property: *every 'test <name> ... <result>' line of libtest output yields one entry with the matching outcome*.

fast-check shrank the failure to: `Counterexample: [[{"name":"a","kind":"should-failed"}]]`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
