import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import camelCase from '../../../../index.js';

const word = fc.stringMatching(/^[a-z]{1,6}$/);
const sep = fc.stringMatching(/^[ \-._]{1,3}$/);
const opts = fc.record({pascalCase: fc.boolean(), preserveConsecutiveUppercase: fc.boolean(), capitalizeAfterNumber: fc.boolean(), locale: fc.constant(false)});
const anyStr = fc.string({unit: fc.constantFrom('a','B','c','D','1','2',' ','-','_','.','$','é','É','Σ','ß','𝐀','😀','́','١'), maxLength: 12});

test('no crash, returns string', () => {
  fc.assert(fc.property(anyStr, opts, (s, o) => { assert.equal(typeof camelCase(s, o), 'string'); }));
});
test('lowercase words join to camelCase', () => {
  fc.assert(fc.property(fc.array(word, {minLength: 1, maxLength: 4}), sep, (ws, s) => {
    const exp = ws.map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join('');
    assert.equal(camelCase(ws.join(s), {locale: false}), exp);
  }));
});
test('array input equals joined by dash', () => {
  fc.assert(fc.property(fc.array(word, {maxLength: 4}), opts, (ws, o) => {
    assert.equal(camelCase(ws, o), camelCase(ws.join('-'), o));
  }));
});
test('idempotent on default for alnum', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-zA-Z0-9 _-]{0,12}$/), s => {
    const o = {locale: false};
    const r = camelCase(s, o);
    assert.equal(camelCase(r, o), r);
  }));
});
test('output has no separators (non-prefix)', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-zA-Z0-9 _.-]{0,12}$/), opts, (s, o) => {
    const r = camelCase(s, o).replace(/^[$_]*/, '');
    assert.ok(!/[ .-]/.test(r), JSON.stringify([s, o, r]));
  }));
});
test('pascal = camel with first upper', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-zA-Z0-9 _.-]{0,12}$/), s => {
    const c = camelCase(s, {locale: false}), p = camelCase(s, {locale: false, pascalCase: true});
    const m = c.match(/^[$_]*/)[0].length;
    assert.equal(p, c.slice(0, m) + c.slice(m, m + 1).toUpperCase() + c.slice(m + 1));
  }));
});
test('letters preserved ignoring case (ascii)', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-zA-Z0-9 _.-]{0,12}$/), opts, (s, o) => {
    const strip = x => x.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    assert.equal(strip(camelCase(s, o)), strip(s));
  }));
});
