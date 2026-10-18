# A lone single-quote value is parsed as an empty string (stringify/parse round-trip fails)

| | |
|---|---|
| Function | `ini.parse (unsafe/isQuoted)` in `lib/ini.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** {a: "'"}

**Expected:** {a: "'"}

**Actual:** {a: ''}

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../../../../../lib/ini.js';

test('repro_single_quote_char', () => {
  assert.deepEqual({ ...mod.parse(mod.stringify({ a: "'" })) }, { a: "'" });
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

## Why this is a bug

safe() guards its quote check with val.length > 1, so a lone "'" is emitted unquoted, but unsafe()'s isQuoted has no length check: a single quote both starts and ends with "'", so slice(1,-1) yields ''. The two halves are inconsistent.

Independent review: In lib/ini.js, safe() deliberately skips quoting when val.length > 1 is false, so "'" is written unquoted as `a='`. unsafe() then calls isQuoted("'"), which is true because the string both starts and ends with "'". The single-quote branch slices it to '', and JSON.parse('') throws and is ignored, so the value becomes ''. A lone `"` survives because JSON.parse fails and leaves it unchanged, so the single-quote path is the only broken one. The repro uses the API correctly and a one-character value is a valid string, so a length check in unsafe's quote handling would be an easy fix a maintainer would likely accept. The impact is narrow.

## How it was found

Property: *unsafe(safe(s)) === s / parse(stringify(obj)) deep-equals obj*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
