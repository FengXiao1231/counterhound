# getBaseConfiguration treats inherited Object.prototype keys (e.g. 'constructor') as known standards

| | |
|---|---|
| Function | `getBaseConfiguration` in `src/helpers.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** getBaseConfiguration('constructor', -1)

**Expected:** { isDecimal: true, ceil: 1000, actualStandard: 'jedec' } (the default fallback used for any unknown standard)

**Actual:** returns the inherited Object function (truthy lookup on a plain object literal); filesize(1000, {standard:'constructor'}) throws TypeError: Cannot read properties of undefined (reading 'bytes') in resolveSymbol

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getBaseConfiguration } from '../../../../../src/helpers.js';

test('repro_proto_standard', () => {
  assert.deepEqual(getBaseConfiguration('constructor', -1), { isDecimal: true, ceil: 1000, actualStandard: 'jedec' });
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

## Why this is a bug

STANDARD_CONFIGS is a plain object, so `STANDARD_CONFIGS[standard]` finds inherited keys (constructor, toString, __proto__, hasOwnProperty). The function's code path explicitly falls back to base/default for unrecognised standards (e.g. 'foo' works), so a string like 'constructor' should behave the same instead of crashing; AGENTS.md also lists prototype-related access as a forbidden pattern.

Independent review: STANDARD_CONFIGS is a plain object literal, so `STANDARD_CONFIGS[standard]` is truthy for inherited keys such as 'constructor', 'toString' and '__proto__'. The function then returns that inherited value instead of falling through to the base override or default, which it does for any other unknown string like 'foo'. The result destructures to undefined fields, and `filesize(1000, {standard:'constructor'})` throws a TypeError in resolveSymbol instead of formatting normally. The input is a string, which is the documented type for `standard`. The fix is trivial (`Object.hasOwn`, or a null-prototype object or Map) and in line with the project's prototype-pollution rule. It is unlikely in practice, so severity is low.

## How it was found

Property: *any standard string other than si/iec/jedec falls back to the base-driven default configuration*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
