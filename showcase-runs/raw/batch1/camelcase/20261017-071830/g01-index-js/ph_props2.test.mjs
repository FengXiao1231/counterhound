import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import camelCase from '../../../../index.js';

const opts = fc.record({pascalCase: fc.boolean(), preserveConsecutiveUppercase: fc.boolean(), capitalizeAfterNumber: fc.boolean(), locale: fc.constant(false)});
const uni = fc.string({unit: fc.constantFrom('a','B','c','D','1','2',' ','-','_','.','é','É','Σ','ß','𝐀','𝐚','١','٢','ǅ','Ⅳ'), maxLength: 10});

test('prefix preserved', () => {
  fc.assert(fc.property(fc.stringMatching(/^[$_]{0,3}$/), fc.stringMatching(/^[a-z]{1,5}$/), fc.stringMatching(/^[a-z]{1,5}$/), opts, (p, a, b, o) => {
    const r = camelCase(p + a + '-' + b, o);
    assert.ok(r.startsWith(p));
  }));
});
test('digits preserved in order (unicode)', () => {
  fc.assert(fc.property(uni, opts, (s, o) => {
    const d = x => x.replace(/[^\p{Decimal_Number}]/gu, '');
    assert.equal(d(camelCase(s, o)), d(s));
  }));
});
test('alphabetic count preserved (unicode)', () => {
  fc.assert(fc.property(uni, opts, (s, o) => {
    const d = x => [...x].filter(c => /\p{Alphabetic}/u.test(c)).length;
    assert.equal(d(camelCase(s, o)), d(s));
  }));
});
test('no separators remain after first char unicode', () => {
  fc.assert(fc.property(uni, opts, (s, o) => {
    const r = camelCase(s, o);
    assert.ok(!/[ .\-]/.test(r), JSON.stringify([s, o, r]));
  }));
});
test('array with whitespace/empty elements', () => {
  fc.assert(fc.property(fc.array(fc.stringMatching(/^[ a-zA-Z0-9]{0,5}$/), {maxLength: 4}), opts, (a, o) => {
    const exp = camelCase(a.map(x => x.trim()).filter(Boolean).join('-'), o);
    assert.equal(camelCase(a, o), exp);
  }));
});
test('locale false equals no-op for ascii vs en-US', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-zA-Z0-9 _.-]{0,12}$/), opts, (s, o) => {
    assert.equal(camelCase(s, {...o, locale: 'en-US'}), camelCase(s, o));
  }));
});
