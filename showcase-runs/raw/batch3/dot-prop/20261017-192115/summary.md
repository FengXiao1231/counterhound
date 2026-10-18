<!-- proofhound-report -->
### proofhound found 1 provable bug (1 with a verified fix)

Checked 6 functions in 1 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> stringifyPath emits an unparseable index like "[1e+21]" for integer numbers >= 1e21 <sub>(wrong result, index.js)</sub></summary>

| | |
|---|---|
| Function | `stringifyPath` |
| Input | stringifyPath([1e21]) |
| Expected | a path string that parsePath accepts (e.g. the number treated as a string key like '1e\+21'/escaped, or a digit-only index) |
| Actual | returns '[1e+21]', and parsePath('[1e+21]') throws "Invalid character 'e' in an index at position 3" |
| Review | low severity, confidence 0.80 |

formatPathSegment sends every non-negative integer to bracket notation via `[${segment}]`. For values >= 1e21, `String(n)` switches to exponent notation, so the output contains 'e' and '+', and parsePath rejects it. The function already sends non-integers and negatives down the escaped-string-key path precisely so the output stays parseable, so this case is an overlooked edge of the same rule. A maintainer would likely accept a small fix, such as treating numbers whose string form is not all digits as string keys. The input is an extreme edge case, so severity is low.

Failing test (`repro_large_number_segment.test.mjs`, failed 3/3 runs):

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

Suggested fix (the repro passes with it; project tests passed (npm test --silent)):

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
</details>

<sub>1m54s · $0.37 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
