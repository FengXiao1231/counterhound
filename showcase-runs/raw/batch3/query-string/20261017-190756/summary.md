<!-- counterhound-report -->
### counterhound found 1 provable bug (1 with a verified fix)

Checked 6 functions in 1 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> stringifyUrl turns an existing index-format array in the URL query into 'a=[object Object]' <sub>(wrong result, base.js)</sub></summary>

| | |
|---|---|
| Function | `stringifyUrl` |
| Input | stringifyUrl({url: 'https://foo.bar?a[0]=x&a[1]=y', query: {}}, {arrayFormat: 'index', encode: false}) |
| Expected | 'https://foo.bar?a[0]=x&a[1]=y' |
| Actual | 'https://foo.bar?a=[object Object]' |
| Review | medium severity, confidence 0.85 |

The index parser in `parse()` collects values into an object keyed by index (`accumulator[key] = {}`). Only `keysSorter` turns that object into an array, and it is skipped when `sort === false`. `stringifyUrl` always parses the existing query with `{sort:false, ...options}` (base.js:573), so with `arrayFormat:'index'` the query keeps the plain object and `stringify` writes it as `[object Object]`. A URL such as `?a[0]=x&a[1]=y` is valid input for the index format, and the existing-query parsing options are meant to work for array formats. Silently corrupting the URL is not intended behaviour, 

Failing test (`repro_index_nosort.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {stringifyUrl} from '../../../../../base.js';

test('repro_index_nosort: stringifyUrl keeps existing index-format array in url', () => {
	assert.equal(
		stringifyUrl({url: 'https://foo.bar?a[0]=x&a[1]=y', query: {}}, {arrayFormat: 'index', encode: false}),
		'https://foo.bar?a[0]=x&a[1]=y',
	);
});
```

Suggested fix (the repro passes with it; project tests passed (npm test --silent)):

```diff
diff --git a/base.js b/base.js
index 6fc590a..ee22055 100644
--- a/base.js
+++ b/base.js
@@ -447,6 +447,12 @@ export function parse(query, options) {
 	}
 
 	if (options.sort === false) {
+		for (const [key, value] of Object.entries(returnValue)) {
+			if (Boolean(value) && typeof value === 'object' && !Array.isArray(value)) {
+				returnValue[key] = keysSorter(value);
+			}
+		}
+
 		return returnValue;
 	}
```
</details>

<sub>1m51s · $0.35 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
