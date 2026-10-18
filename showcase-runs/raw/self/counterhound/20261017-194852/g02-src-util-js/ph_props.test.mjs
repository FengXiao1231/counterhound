import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import path from 'node:path';
import { slug, hash, fmtMs, relPath, extractJSON, sh } from '../../../../src/util.js';

test('slug charset and length', () => {
  fc.assert(fc.property(fc.string({unit:'binary'}), fc.integer({min:1,max:60}), (s, m) => {
    const r = slug(s, m);
    assert.match(r, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(r.length <= Math.max(m,1));
  }));
});
test('hash length and determinism', () => {
  fc.assert(fc.property(fc.string(), fc.integer({min:0,max:40}), (s, n) => {
    assert.equal(hash(s,n).length, n);
    assert.equal(hash(s,n), hash(s,n));
  }));
});
test('fmtMs never prints 60s or NNmSS with SS>=60', () => {
  fc.assert(fc.property(fc.integer({min:0,max:10_000_000}), (ms) => {
    const r = fmtMs(ms);
    assert.doesNotMatch(r, /^60s$/);
    const m = r.match(/^(\d+)m(\d\d)s$/);
    if (m) assert.ok(+m[2] < 60, r);
  }));
});
test('relPath of child inside root is relative', () => {
  const seg = fc.stringMatching(/^[a-z.]{1,6}$/).filter(x => x !== '.' && x !== '..');
  fc.assert(fc.property(fc.array(seg,{minLength:1,maxLength:3}), (segs) => {
    const p = path.join('/root', ...segs);
    assert.equal(relPath('/root', p), segs.join('/'));
  }));
});
test('extractJSON round trip in prose/fence', () => {
  fc.assert(fc.property(fc.jsonValue().filter(v => v !== null && typeof v === 'object'), (v) => {
    const j = JSON.stringify(v);
    assert.deepEqual(extractJSON('Here you go:\n```json\n' + j + '\n```\nDone'), v);
    assert.deepEqual(extractJSON('Result: ' + j), v);
  }));
});
test('sh never throws', () => {
  const r = sh('definitely-not-a-cmd-xyz', []);
  assert.equal(r.code, 127);
});
