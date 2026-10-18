import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import mod from '../../../../lib/ini.js';
const { parse, stringify } = mod;

const plain = (o) => JSON.parse(JSON.stringify(o));
const str = fc.string({ unit: fc.constantFrom(...'ab1 ;#\\"\'=[]\n.-_xyz'.split('')), maxLength: 8 });
const key = fc.string({ unit: fc.constantFrom(...'abc12_-'.split('')), minLength: 1, maxLength: 5 });
const scalar = fc.oneof(str, fc.boolean(), fc.constant(null));

test('roundtrip flat scalar values', () => {
  fc.assert(fc.property(fc.dictionary(key, scalar), (o) => {
    assert.deepEqual(plain(parse(stringify(o))), plain(o));
  }));
});

test('roundtrip string values only', () => {
  fc.assert(fc.property(fc.dictionary(key, str.filter(s => !['true','false','null'].includes(s.trim()))), (o) => {
    assert.deepEqual(plain(parse(stringify(o))), plain(o));
  }));
});

test('roundtrip arrays (len>=2)', () => {
  fc.assert(fc.property(fc.dictionary(key, fc.array(str.filter(s => !['true','false','null'].includes(s.trim())), { minLength: 2, maxLength: 4 })), (o) => {
    assert.deepEqual(plain(parse(stringify(o))), plain(o));
  }));
});

test('roundtrip sections', () => {
  fc.assert(fc.property(fc.dictionary(key, fc.dictionary(key, fc.oneof(fc.boolean(), fc.string({unit: fc.constantFrom(...'abc 1'.split('')), maxLength: 5}).filter(s=>s===s.trim()&&!['true','false','null'].includes(s))))), (o) => {
    assert.deepEqual(plain(parse(stringify(o))), plain(o));
  }));
});

test('roundtrip section names with dots', () => {
  fc.assert(fc.property(fc.dictionary(fc.string({unit: fc.constantFrom(...'ab.'.split('')), minLength:1, maxLength:4}).filter(s=>!s.startsWith('.')&&!s.endsWith('.')&&!s.includes('..')), fc.dictionary(key, fc.boolean(), {minKeys:1}), {minKeys:1}), (o) => {
    assert.deepEqual(plain(parse(stringify(o))), plain(o));
  }));
});

test('whitespace/align options do not change parse result', () => {
  fc.assert(fc.property(fc.dictionary(key, scalar), (o) => {
    const base = plain(parse(stringify(o)));
    assert.deepEqual(plain(parse(stringify(o, { align: true }))), base);
    assert.deepEqual(plain(parse(stringify(o, { whitespace: true, sort: true, newline: true }))), base);
  }));
});

test('non-bracketed arrays roundtrip', () => {
  fc.assert(fc.property(fc.dictionary(key, fc.array(fc.constantFrom('a','b','c'), { minLength: 2, maxLength: 3 })), (o) => {
    assert.deepEqual(plain(parse(stringify(o, { bracketedArray: false }), { bracketedArray: false })), plain(o));
  }));
});

test('safe/unsafe roundtrip', () => {
  fc.assert(fc.property(str, (s) => {
    assert.equal(mod.unsafe(mod.safe(s)), s);
  }));
});
