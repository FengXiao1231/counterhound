# stringifyPath emits an unparseable index like "[1e+21]" for integer numbers >= 1e21

| | |
|---|---|
| Function | `stringifyPath` in `index.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** stringifyPath([1e21])

**Expected:** a path string that parsePath accepts (e.g. the number treated as a string key like '1e\+21'/escaped, or a digit-only index)

**Actual:** returns '[1e+21]', and parsePath('[1e+21]') throws "Invalid character 'e' in an index at position 3"

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {stringifyPath, parsePath} from '../../../../../index.js';

test('repro_large_number_segment', () => {
	// stringifyPath output must be a valid path string that parsePath accepts.
	const path = stringifyPath([1e21]);
	assert.doesNotThrow(() => parsePath(path), `stringifyPath([1e21]) gave unparseable ${JSON.stringify(path)}`);
});
```

Fails with `AssertionError: Got unwanted exception: stringifyPath([1e21]) gave unparseable "[1e+21]"`

Run it with `node --test repro_large_number_segment.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests passed (npm test --silent). Apply it with `git apply fix.patch`.

```diff
diff --git a/index.js b/index.js
index fd0a010..9c02e04 100644
--- a/index.js
+++ b/index.js
@@ -429,8 +429,8 @@ function formatPathSegment(segment, isFirst, startsOutput, preferDotForIndices)
 	const useDotForIndex = !isFirst && (preferDotForIndices || startsOutput);
 
 	if (typeof segment === 'number') {
-		// Non-integer or negative numbers are treated as string keys.
-		if (!Number.isInteger(segment) || segment < 0) {
+		// Non-integer, negative, or exponent-notation (>= 1e21) numbers are treated as string keys.
+		if (!Number.isInteger(segment) || segment < 0 || segment >= 1e21) {
 			const escaped = escapePath(String(segment));
 			return isFirst ? escaped : `.${escaped}`;
 		}
```

## Why this is a bug

readme: stringifyPath 'Returns a string path that can be used with other dot-prop functions'; type is Array<string | number>. Number.isInteger(1e21) is true so formatPathSegment uses `[${segment}]`, which stringifies in exponent notation.

Independent review: formatPathSegment sends every non-negative integer to bracket notation via `[${segment}]`. For values >= 1e21, `String(n)` switches to exponent notation, so the output contains 'e' and '+', and parsePath rejects it. The function already sends non-integers and negatives down the escaped-string-key path precisely so the output stays parseable, so this case is an overlooked edge of the same rule. A maintainer would likely accept a small fix, such as treating numbers whose string form is not all digits as string keys. The input is an extreme edge case, so severity is low.

## How it was found

Property: *for any finite number segment, parsePath(stringifyPath(segs)) does not throw (stringifyPath returns 'a string path that can be used with other dot-prop functions')*.

fast-check shrank the failure to: `Counterexample: [[1e+21,""]]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
