import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJavaTrace } from '../../../../src/lang/java.js';

test('repro_suppressed', () => {
  const t = 'java.lang.RuntimeException: boom\n\tat p.A.run(A.java:3)\n\tSuppressed: java.io.IOException: x\n\t\tat p.B.close(B.java:9)\n';
  const r = parseJavaTrace(t, (c, f) => '/p/' + f);
  assert.deepEqual(r.frames.map((f) => f.file), ['/p/A.java']);
});
