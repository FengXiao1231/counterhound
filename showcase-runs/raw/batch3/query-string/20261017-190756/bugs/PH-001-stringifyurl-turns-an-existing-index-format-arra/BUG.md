# stringifyUrl turns an existing index-format array in the URL query into 'a=[object Object]'

| | |
|---|---|
| Function | `stringifyUrl` in `base.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** stringifyUrl({url: 'https://foo.bar?a[0]=x&a[1]=y', query: {}}, {arrayFormat: 'index', encode: false})

**Expected:** 'https://foo.bar?a[0]=x&a[1]=y'

**Actual:** 'https://foo.bar?a=[object Object]'

## Reproduce

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

Fails with `AssertionError: Expected values to be strictly equal:`

Run it with `node --test repro_index_nosort.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests passed (npm test --silent). Apply it with `git apply fix.patch`.

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

## Why this is a bug

stringifyUrl parses the existing query with {sort:false, ...options}; in parse(), index-format arrays are only converted from index-keyed objects to arrays by keysSorter, which is skipped when sort === false, so an object is returned and stringified as [object Object]. The README documents arrayFormat 'index' parsing to arrays, and an existing test ('stringifyUrl uses parsing options when parsing existing query from url') shows the intent that array formats work for existing URL queries. Likewise parse(q,{arrayFormat:'index',sort:false}) returns an object instead of an array.

Independent review: The index parser in `parse()` collects values into an object keyed by index (`accumulator[key] = {}`). Only `keysSorter` turns that object into an array, and it is skipped when `sort === false`. `stringifyUrl` always parses the existing query with `{sort:false, ...options}` (base.js:573), so with `arrayFormat:'index'` the query keeps the plain object and `stringify` writes it as `[object Object]`. A URL such as `?a[0]=x&a[1]=y` is valid input for the index format, and the existing-query parsing options are meant to work for array formats. Silently corrupting the URL is not intended behaviour, and a maintainer would likely accept a fix, such as converting the index objects to arrays even when sort is false.

## How it was found

Property: *stringifyUrl({url: u, query: {}}, {arrayFormat:'index'}) leaves an existing query like a[0]=x&a[1]=y unchanged*.

fast-check shrank the failure to: `Counterexample: [["0"]]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
