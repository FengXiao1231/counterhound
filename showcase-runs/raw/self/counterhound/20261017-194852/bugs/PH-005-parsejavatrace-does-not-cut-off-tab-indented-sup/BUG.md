# parseJavaTrace does not cut off tab-indented 'Suppressed:' sections, so their frames are attributed to the primary exception

| | |
|---|---|
| Function | `parseJavaTrace` in `src/lang/java.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** java.lang.RuntimeException: boom\n\tat p.A.run(A.java:3)\n\tSuppressed: java.io.IOException: x\n\t\tat p.B.close(B.java:9)\n

**Expected:** frames only for A.java (the code splits the trace at Caused by/Suppressed to keep only the primary exception)

**Actual:** frames contains both A.java and B.java, because the split regex /\n(?:Caused by|Suppressed): / requires the keyword at column 0

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJavaTrace } from '../../../../../src/lang/java.js';

test('repro_suppressed', () => {
  const t = 'java.lang.RuntimeException: boom\n\tat p.A.run(A.java:3)\n\tSuppressed: java.io.IOException: x\n\t\tat p.B.close(B.java:9)\n';
  const r = parseJavaTrace(t, (c, f) => '/p/' + f);
  assert.deepEqual(r.frames.map((f) => f.file), ['/p/A.java']);
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

Run it with `node --test repro_suppressed.test.mjs` (fix the import path if you move it).

## Why this is a bug

Java's Throwable.printStackTrace emits suppressed exceptions as '\tSuppressed: ...' (tab-indented); the code's own split on 'Suppressed: ' shows it intends to cut them off.

Independent review: src/lang/java.js:217 splits on /\n(?:Caused by|Suppressed): / to keep only the primary exception. Throwable.printStackTrace indents suppressed exceptions with a tab ('\tSuppressed: ...'), and a cause nested inside a suppressed exception is also indented. So the Suppressed branch of the regex can never match real JVM output, and the frame regex (/^\s*at .../gm) then collects the suppressed exception's frames. The repro is valid, and the intent is clear from the code. Changing the split to /\n\s*(?:Caused by|Suppressed): / is a small, safe fix that a maintainer would accept. Impact is limited to traces that contain suppressed exceptions.

## How it was found

Property: *frames of a suppressed exception are not included in the frames of the primary exception*.

fast-check shrank the failure to: `Counterexample: ["A","A"]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
