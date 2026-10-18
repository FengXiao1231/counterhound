# relPath returns the absolute path for children whose name starts with '..'

| | |
|---|---|
| Function | `relPath` in `src/util.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** relPath('/root', '/root/..foo/a.js')

**Expected:** '..foo/a.js'

**Actual:** '/root/..foo/a.js' (absolute path returned)

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { relPath } from '../../../../../src/util.js';
test('repro_relpath_dotdot_name', () => {
  assert.equal(relPath('/root', '/root/..foo/a.js'), '..foo/a.js');
});
```

Fails with `AssertionError: Expected values to be strictly equal:`

Run it with `node --test repro_relpath_dotdot_name.test.mjs` (fix the import path if you move it).

## Why this is a bug

r.startsWith('..') is meant to detect parent traversal, but also matches legitimate names like '..foo' or '...'; it should check r === '..' or startsWith('..' + sep).

Independent review: `relPath` in src/util.js:144 uses `r.startsWith('..')` to detect paths outside the root. `path.relative('/root', '/root/..foo/a.js')` returns `'..foo/a.js'`, which is inside the root, so `relPath` wrongly falls back to the absolute path. Valid names like `..foo` or `...` are rare, but a maintainer would accept the one-line fix of checking `r === '..' || r.startsWith('..' + path.sep)`. I did not run the repro myself; I confirmed the cause by reading the source.

## How it was found

Property: *a path inside root yields a relative path*.

fast-check shrank the failure to: `Counterexample: [["..a"]]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
