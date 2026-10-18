import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import mod from '../../../../punycode.js';
const { encode, decode, toUnicode, toASCII } = mod;

const uni = fc.string({ unit: 'binary', maxLength: 20 }).map((s) => s.toWellFormed());
const label = fc.array(fc.oneof(fc.integer({ min: 0x61, max: 0x7a }), fc.integer({ min: 0x80, max: 0x2fff }), fc.integer({ min: 0x10000, max: 0x10ffff })), { maxLength: 15 })
  .map((a) => String.fromCodePoint(...a));

test('decode(encode(x)) == x', () => {
  fc.assert(fc.property(uni, (s) => { assert.equal(decode(encode(s)), s); }));
});

test('encode output is ASCII', () => {
  fc.assert(fc.property(uni, (s) => { assert.match(encode(s), /^[\x00-\x7f]*$/); }));
});

test('encode(x) for ASCII-only x is x + "-" (or empty)', () => {
  fc.assert(fc.property(fc.string({ unit: 'grapheme-ascii', maxLength: 15 }), (s) => {
    assert.equal(encode(s), s ? s + '-' : '');
  }));
});

test('toUnicode(toASCII(x)) == x for labels', () => {
  fc.assert(fc.property(fc.array(label.filter((l) => !/^xn--/i.test(l)), { minLength: 1, maxLength: 4 }), (ls) => {
    const d = ls.join('.');
    assert.equal(toUnicode(toASCII(d)), d);
  }));
});

test('toASCII idempotent', () => {
  fc.assert(fc.property(fc.array(label, { maxLength: 4 }), (ls) => {
    const d = ls.join('.');
    assert.equal(toASCII(toASCII(d)), toASCII(d));
  }));
});

test('toASCII/toUnicode preserve text outside the domain in emails with several @', () => {
  fc.assert(fc.property(fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { minLength: 3, maxLength: 4 }), (parts) => {
    const s = parts.join('@');
    assert.equal(toASCII(s), s);
    assert.equal(toUnicode(s), s);
  }));
});

test('email local part untouched', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-z]{1,5}$/), label, (l, d) => {
    assert.equal(toASCII(l + '@' + d).split('@')[0], l);
  }));
});
