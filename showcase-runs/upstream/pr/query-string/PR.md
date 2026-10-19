TITLE: Keep index-format arrays from the URL when stringifyUrl merges the query
REPO: sindresorhus/query-string
BASE: main
BRANCH: fix-stringify-url-index-arrays
SEARCH: stringifyUrl object Object index
BODY:
Before:

```js
stringifyUrl({url: 'https://foo.bar?a[0]=x&a[1]=y', query: {}}, {arrayFormat: 'index', encode: false})
//=> 'https://foo.bar?a=[object Object]'
```

`stringifyUrl` parses the query already present in the URL with `sort: false`, and in that branch `parse()` returns an index-format array as a plain object `{0: 'x', 1: 'y'}` rather than an array (the conversion through `keysSorter` only happens in the sorted branch). `stringify()` then prints the object as `[object Object]`.

After: the existing array survives the round trip: `'https://foo.bar?a[0]=x&a[1]=y'`, and merging with new keys works (`a[1]=y&a[0]=x` + `{b: 1}` gives `a[0]=x&a[1]=y&b=1`).

How: in the `sort === false` branch of `parse()`, convert object values to arrays with `keysSorter` exactly as the sorted branch does, leaving the key order untouched. Two assertions added to `test/stringify-url.js`. The full suite passes (`npm test`).
