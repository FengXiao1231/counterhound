# stringify/parse does not round-trip string values with a backslash before ';' or '#'

| | |
|---|---|
| Function | `ini.stringify / ini.parse` in `lib/ini.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** {a: '\\;'} (a backslash followed by a semicolon)

**Expected:** parse(stringify({a:'\\;'})) -> {a:'\\;'}

**Actual:** {a:'\\'} (the ';' is treated as a comment start)

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../../../../../lib/ini.js';

test('repro_backslash_semicolon', () => {
  assert.deepEqual({ ...mod.parse(mod.stringify({ a: '\\;' })) }, { a: '\\;' });
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

## Why this is a bug

stringify escapes ';' and '#' with a backslash but does not escape a preceding backslash, so the output 'a=\\;' is read by parse as an escaped backslash followed by an unescaped comment marker. encode/decode are a documented inverse pair, and safe() exists to make values round-trippable.

Independent review: `unsafe()` treats `\\` as an escaped backslash, and `\;` or `\#` as an escaped comment character. `safe()` escapes only `;` and `#`, and never escapes the backslash. So the value `\;` is written as `\;`, which `unsafe()` reads as a backslash followed by an unescaped `;`. The rest of the value is dropped as a comment, so data is silently lost. The same asymmetry loses data for any value with consecutive backslashes (`\\` comes back as `\`). `safe()` and `unsafe()` are exported as a pair, and `safe()` already falls back to `JSON.stringify` for other values that would not survive, so a small fix is plausible, such as quoting values that contain a backslash next to a backslash, `;` or `#`. The input is a valid string and nothing in the code or tests excludes it. The only doubt is that the corner case is narrow and the README makes no explicit round-trip promise.

## How it was found

Property: *parse(stringify(obj)) deep-equals obj for string values*.

fast-check shrank the failure to: `Counterexample: [{"a":"\\\\"}]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
