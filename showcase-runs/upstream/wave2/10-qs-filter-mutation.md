TITLE: stringify sorts the caller's `filter` array in place when `sort` is given
REPO: ljharb/qs
SEARCH: stringify filter sort mutate
BODY:
```js
const qs = require('qs');
const filter = ['i', 'a'];
qs.stringify({ i: 1, a: 2 }, { filter, sort: (a, b) => a.localeCompare(b) });
// => 'a=2&i=1'
filter; // => ['a', 'i']   (expected ['i', 'a'])
```

In `lib/stringify.js`, when `filter` is an array it becomes `objKeys` directly (`objKeys = filter;`) and is then sorted in place with `objKeys.sort(options.sort)`, so the options object the caller passed is modified. With the top-level call the same array is reused for every nested object, so order can also change between calls.

Reproduced on 6.16.1 (main 47cf3f1). A copy (`objKeys = filter.slice()` or `[...filter]`) before sorting would fix it. Happy to send a PR with a test if you would take one.
