import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parseJavaTrace, parseJUnitXml } from '../../../../src/lang/java.js';

const id = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,6}$/);
const resolve = (c, f) => '/p/' + f;

test('suppressed frames are not attributed to the main exception', () => {
  fc.assert(fc.property(id, id, (a, b) => {
    const t = `java.lang.RuntimeException: boom\n\tat p.${a}.run(${a}.java:3)\n\tSuppressed: java.io.IOException: x\n\t\tat p.${b}.close(${b}.java:9)\n`;
    const r = parseJavaTrace(t, resolve);
    assert.equal(r.frames.length, 1);
  }));
});

test('CDATA content is not entity-decoded', () => {
  fc.assert(fc.property(id, (a) => {
    const xml = `<testcase name="t" classname="C"><failure message="m" type="T"><![CDATA[java.lang.AssertionError: a &lt;${a}&gt; b\n\tat p.C.t(C.java:1)\n]]></failure></testcase>`;
    const r = parseJUnitXml(xml, resolve)[0];
    assert.ok(r.error.message.includes(`&lt;${a}&gt;`));
  }));
});
