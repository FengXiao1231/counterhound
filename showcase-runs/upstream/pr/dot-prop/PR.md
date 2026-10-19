TITLE: Make stringifyPath produce a parseable path for numbers at or above 1e21
REPO: sindresorhus/dot-prop
BASE: main
BRANCH: fix-stringify-path-large-numbers
SEARCH: stringifyPath 1e21 exponent
BODY:
Before: `stringifyPath([1e21])` returns `'[1e+21]'`, and `parsePath('[1e+21]')` throws `Invalid character 'e' in an index at position 3`. `Number.isInteger(1e21)` is true, so `formatPathSegment` prints the number as an index, but `String(1e21)` is in exponent notation, which the index parser does not accept. The readme says `stringifyPath` "Returns a string path that can be used with other dot-prop functions".

After: `stringifyPath([1e21])` returns `'1e+21'` and `stringifyPath(['foo', 1e21, 'bar'])` returns `'foo.1e+21.bar'`, which `parsePath` reads back as `['1e+21']` and `['foo', '1e+21', 'bar']`: the number is treated as a string key, the same way non-integer and negative numbers already are.

How: one extra condition (`segment >= 1e21`) in `formatPathSegment`, and a test in `test.js` covering the round trip. The suite passes (`npm test`).
