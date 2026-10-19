TITLE: comma: true is ignored with charset 'iso-8859-1' and interpretNumericEntities
REPO: ljharb/qs
SEARCH: comma interpretNumericEntities iso-8859-1
BODY:
```js
const qs = require('qs');
qs.parse('a=b,c', { comma: true });
// => { a: ['b', 'c'] }
qs.parse('a=b,c', { comma: true, charset: 'iso-8859-1', interpretNumericEntities: true });
// => { a: 'b,c' }      (expected { a: ['b', 'c'] })
```

In `lib/parse.js` the comma splitting happens first (`parseArrayValue`), producing an array, and only afterwards `if (val && options.interpretNumericEntities && charset === 'iso-8859-1') val = interpretNumericEntities(String(val));` runs on the result, which turns the array back into the string `'b,c'`. So the two options cancel each other out. Numeric entities should be interpreted per element (or before the split) instead of stringifying the array.

Reproduced on 6.16.1 (main 47cf3f1). Happy to send a PR with a test if you would take one.
