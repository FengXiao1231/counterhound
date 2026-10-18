import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import mod from '../../../../lib/utils.js';
const { decode, encode, arrayToObject, toCoercible, merge, markOverflow, isOverflow } = mod;

const ref = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const wide = fc.oneof(fc.string({ unit: 'grapheme', maxLength: 2500 }), fc.string({ unit: 'binary', maxLength: 2500 })).map((s) => s.toWellFormed());

test('encode utf8 matches reference (surrogate boundaries)', () => {
  fc.assert(fc.property(fc.array(fc.constantFrom('a', '😀', 'é', '€', '~', ' ', '+', '(', '*'), { maxLength: 2500 }).map((a) => a.join('')), (s) => {
    assert.equal(encode(s, null, 'utf-8'), ref(s));
  }));
});
test('encode utf8 wellformed random', () => {
  fc.assert(fc.property(wide, (s) => { assert.equal(encode(s, null, 'utf-8'), ref(s)); }));
});
test('utf8 roundtrip', () => {
  fc.assert(fc.property(wide, (s) => { assert.equal(decode(encode(s, null, 'utf-8'), null, 'utf-8'), s); }));
});
test('latin1 roundtrip', () => {
  const l1 = fc.string({ unit: fc.integer({ min: 0, max: 255 }).map((n) => String.fromCharCode(n)), maxLength: 50 });
  fc.assert(fc.property(l1, (s) => { assert.equal(decode(encode(s, null, 'iso-8859-1'), null, 'iso-8859-1'), s); }));
});
test('decode utf8 matches reference', () => {
  fc.assert(fc.property(fc.string({ unit: fc.constantFrom('%', 'A', '4', '1', 'C', '3', '+', 'b', 'f', 'E', '0'), maxLength: 12 }), (s) => {
    let r; const p = s.replace(/\+/g, ' ');
    try { r = decodeURIComponent(p); } catch (e) { r = p; }
    assert.equal(decode(s, null, 'utf-8'), r);
  }));
});
test('decode latin1 matches reference', () => {
  fc.assert(fc.property(fc.string({ unit: fc.constantFrom('%', 'A', '4', '1', 'C', '3', '+', 'b', 'f', 'E', '0', 'u'), maxLength: 12 }), (s) => {
    const p = s.replace(/\+/g, ' ');
    assert.equal(decode(s, null, 'iso-8859-1'), p.replace(/%[0-9a-f]{2}/gi, (m) => String.fromCharCode(parseInt(m.slice(1), 16))));
  }));
});
test('arrayToObject', () => {
  fc.assert(fc.property(fc.array(fc.option(fc.integer(), { nil: undefined })), fc.boolean(), (a, po) => {
    const o = arrayToObject(a, { plainObjects: po });
    const exp = {}; a.forEach((v, i) => { if (v !== undefined) exp[i] = v; });
    assert.deepEqual({ ...o }, exp);
    assert.equal(Object.getPrototypeOf(o) === null, po);
  }));
});
test('toCoercible then String never throws', () => {
  const leaf = fc.oneof(fc.integer(), fc.string(), fc.constant(null), fc.constant(undefined), fc.constant(Object.create(null)), fc.constant({ valueOf: 1, toString: null }));
  const v = fc.letrec((t) => ({ t: fc.oneof(leaf, fc.array(t('t'), { maxLength: 4 })) })).t;
  fc.assert(fc.property(v, (x) => { String(toCoercible(x)); }));
});
test('toCoercible plain arrays identity', () => {
  fc.assert(fc.property(fc.array(fc.oneof(fc.integer(), fc.string(), fc.array(fc.integer()))), (a) => {
    assert.equal(toCoercible(a), a);
    assert.equal(String(toCoercible(a)), String(a));
  }));
});
test('merge array + scalar with limits', () => {
  fc.assert(fc.property(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }), fc.string({ minLength: 1 }), fc.integer({ min: 0, max: 6 }), (t, s, lim) => {
    const r = merge(t.slice(), s, { arrayLimit: lim });
    if (Array.isArray(r)) { assert.deepEqual(r, [...t, s]); assert.ok(r.length <= lim); }
    else { assert.ok(isOverflow(r)); assert.deepEqual(Object.values(r), [...t, s]); }
  }));
});
test('merge array into scalar', () => {
  fc.assert(fc.property(fc.string({ minLength: 1 }), fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }), fc.integer({ min: 0, max: 6 }), (t, s, lim) => {
    const r = merge(t, s, { arrayLimit: lim });
    const all = [t, ...s];
    assert.deepEqual(Object.values(r), all);
    assert.equal(Array.isArray(r), all.length <= lim);
  }));
});
test('merge scalar chain', () => {
  fc.assert(fc.property(fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 6 }), fc.integer({ min: 0, max: 3 }), (xs, lim) => {
    let acc = xs[0];
    for (const x of xs.slice(1)) acc = merge(acc, x, { arrayLimit: lim });
    assert.deepEqual(Object.values(acc), xs);
  }));
});
test('markOverflow returns obj', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 10 }), (n) => { const o = {}; assert.equal(markOverflow(o, n), o); assert.ok(isOverflow(o)); }));
});
