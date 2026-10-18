import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { split, splitSeparateNumbers, noCase, camelCase, pascalCase, pascalSnakeCase } from '../../../../packages/change-case/src/index.ts';

const alnum = fc.stringMatching(/^[a-zA-Z0-9 _\-.]{0,20}$/);
const anyStr = fc.string({ unit: 'binary', maxLength: 20 });

test('split words are nonempty, no NUL or separators', () => {
  fc.assert(fc.property(anyStr, (s) => {
    for (const w of split(s)) { assert.ok(w.length > 0); assert.ok(/^[\p{L}\d]+$/u.test(w)); }
  }));
});
test('split idempotent on joined output', () => {
  fc.assert(fc.property(anyStr, (s) => {
    const w = split(s);
    assert.deepEqual(split(w.join(' ')), w);
  }));
});
test('splitSeparateNumbers: join equals split join, no letter/digit adjacency', () => {
  fc.assert(fc.property(anyStr, (s) => {
    const w = splitSeparateNumbers(s);
    assert.equal(w.join(''), split(s).join(''));
    for (const x of w) assert.ok(x.length > 0 && !/(\d)\p{Ll}|(\p{L})\d/u.test(x), JSON.stringify(w));
  }));
});
test('noCase lowercases words', () => {
  fc.assert(fc.property(alnum, (s) => {
    assert.equal(noCase(s, { locale: false }), split(s).map((w) => w.toLowerCase()).join(' '));
  }));
});
test('noCase idempotent (ascii)', () => {
  fc.assert(fc.property(alnum, (s) => {
    const a = noCase(s);
    assert.equal(noCase(a), a);
  }));
});
test('camelCase starts lower, pascalCase ascii agree', () => {
  fc.assert(fc.property(alnum, (s) => {
    const c = camelCase(s), p = pascalCase(s);
    if (p.length) assert.equal(c.slice(1), p.slice(1));
  }));
});
test('pascalSnakeCase words capitalised (unicode letters)', () => {
  fc.assert(fc.property(fc.stringMatching(/^[\u{10428}\u{10400}a-z]{1,6}$/u), (s) => {
    const out = pascalSnakeCase(s, { locale: false });
    for (const w of out.split('_')) {
      const cps = [...w];
      assert.equal(cps[0], cps[0].toUpperCase(), out);
    }
  }));
});
