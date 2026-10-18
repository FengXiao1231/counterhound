import test from 'node:test';
import assert from 'node:assert/strict';
import fcOrig from 'fast-check';
const fc = { ...fcOrig, dictionary: (k, v, o = {}) => fcOrig.dictionary(k, v, { minKeys: 1, noNullPrototype: true, ...o }) };
import parse from '../../../../lib/parse.js';
import stringify from '../../../../lib/stringify.js';

const word = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const val = fc.stringMatching(/^[a-zA-Z0-9 _.~-]{0,6}$/);
const dictionary = (k, v, o = {}) => fc.dictionary(k, v, { minKeys: 1, noNullPrototype: true, ...o });

test('simple pairs parse to object', () => {
  fc.assert(fc.property(fc.uniqueArray(word, { maxLength: 8 }), fc.array(val, { minLength: 8, maxLength: 8 }), (keys, vals) => {
    const str = keys.map((k, i) => k + '=' + encodeURIComponent(vals[i])).join('&');
    const exp = {};
    keys.forEach((k, i) => { exp[k] = vals[i]; });
    assert.deepEqual(parse(str), exp);
  }));
});

test('stringify/parse round trip nested', () => {
  const leaf = val.filter((s) => s !== '');
  const tree = fc.dictionary(word, fc.oneof(leaf, fc.dictionary(word, leaf, { maxKeys: 3 }), fc.array(leaf, { minLength: 1, maxLength: 5 })), { maxKeys: 4 });
  fc.assert(fc.property(tree, (o) => {
    assert.deepEqual(parse(stringify(o)), o);
  }));
});

test('allowDots roundtrip', () => {
  const leaf = val.filter((s) => s !== '');
  const tree = fc.dictionary(word, fc.oneof(leaf, fc.dictionary(word, leaf, { maxKeys: 3 })), { maxKeys: 4 });
  fc.assert(fc.property(tree, (o) => {
    assert.deepEqual(parse(stringify(o, { allowDots: true }), { allowDots: true }), o);
  }));
});

test('duplicates modes', () => {
  fc.assert(fc.property(word, fc.array(val.filter((s) => s !== ''), { minLength: 1, maxLength: 6 }), (k, vs) => {
    const str = vs.map((v) => k + '=' + encodeURIComponent(v)).join('&');
    assert.deepEqual(parse(str, { duplicates: 'first' }), { [k]: vs[0] });
    assert.deepEqual(parse(str, { duplicates: 'last' }), { [k]: vs[vs.length - 1] });
    assert.deepEqual(parse(str), { [k]: vs.length === 1 ? vs[0] : vs });
  }));
});

test('parameterLimit', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 10 }), fc.integer({ min: 0, max: 15 }), (lim, n) => {
    const str = Array.from({ length: n }, (_, i) => 'k' + i + '=v').join('&');
    const r = parse(str, { parameterLimit: lim });
    assert.equal(Object.keys(r).length, Math.min(lim, n));
    if (n > lim) assert.throws(() => parse(str, { parameterLimit: lim, throwOnLimitExceeded: true }), RangeError);
    else assert.doesNotThrow(() => parse(str, { parameterLimit: lim, throwOnLimitExceeded: true }));
  }));
});

test('comma option', () => {
  fc.assert(fc.property(word, fc.array(val.filter((s) => s !== ''), { minLength: 2, maxLength: 6 }), (k, vs) => {
    assert.deepEqual(parse(k + '=' + vs.map(encodeURIComponent).join(','), { comma: true }), { [k]: vs });
  }));
});

test('indices arrays within limit, qs a[i]', () => {
  fc.assert(fc.property(word, fc.array(val.filter((s) => s !== ''), { minLength: 1, maxLength: 10 }), (k, vs) => {
    const str = vs.map((v, i) => `${k}[${i}]=${encodeURIComponent(v)}`).join('&');
    assert.deepEqual(parse(str), { [k]: vs });
    const str2 = vs.map((v) => `${k}[]=${encodeURIComponent(v)}`).join('&');
    assert.deepEqual(parse(str2), { [k]: vs });
  }));
});

test('string and object input agree', () => {
  const tree = fc.dictionary(word, fc.oneof(val, fc.dictionary(word, val, { maxKeys: 3 })), { maxKeys: 4 });
  fc.assert(fc.property(tree, (o) => {
    assert.deepEqual(parse(o), parse(stringify(o, { encode: false })));
  }));
});

test('does not mutate input object', () => {
  const tree = fc.dictionary(word, fc.oneof(val, fc.array(val, { maxLength: 3 }), fc.dictionary(word, val, { maxKeys: 3 })), { maxKeys: 4 });
  fc.assert(fc.property(tree, (o) => {
    const copy = JSON.parse(JSON.stringify(o));
    parse(o);
    assert.deepEqual(o, copy);
  }));
});

test('arbitrary strings never crash and no prototype pollution', () => {
  fc.assert(fc.property(fc.string({ unit: fc.constantFrom('a', 'b', '[', ']', '=', '&', '.', '%', '5', 'B', 'D', '1', '_', 'p', 'r', 'o', 't', ',') }), fc.record({ allowDots: fc.boolean(), comma: fc.boolean(), plainObjects: fc.boolean(), depth: fc.integer({ min: 0, max: 4 }), parseArrays: fc.boolean(), allowEmptyArrays: fc.boolean(), strictNullHandling: fc.boolean() }), (s, o) => {
    parse(s, o);
    assert.equal({}.polluted, undefined);
  }));
});

test('no hasOwn-less keys: result keys with plainObjects false do not shadow prototype', () => {
  fc.assert(fc.property(fc.constantFrom('hasOwnProperty', 'toString', '__proto__', 'constructor'), val, (k, v) => {
    const r = parse(`${k}=${v}`);
    assert.equal(Object.getPrototypeOf(r), Object.prototype);
    assert.equal(Object.prototype.hasOwnProperty.call(r, k), false);
  }));
});

test('ignoreQueryPrefix', () => {
  fc.assert(fc.property(fc.uniqueArray(word, { maxLength: 5 }), (keys) => {
    const s = keys.map((k) => k + '=1').join('&');
    assert.deepEqual(parse('?' + s, { ignoreQueryPrefix: true }), parse(s));
  }));
});

test('depth limit', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 8 }), (d, n) => {
    const str = 'a' + Array.from({ length: n }, (_, i) => `[k${i}]`).join('') + '=v';
    const r = parse(str, { depth: d });
    let cur = r.a; let levels = 0;
    while (cur && typeof cur === 'object' && Object.keys(cur).length === 1 && /^k\d+$/.test(Object.keys(cur)[0])) { cur = cur[Object.keys(cur)[0]]; levels++; }
    assert.equal(levels, Math.min(d, n));
    if (n > d) assert.throws(() => parse(str, { depth: d, strictDepth: true }), RangeError);
  }));
});

test('strictNullHandling', () => {
  fc.assert(fc.property(word, (k) => {
    assert.deepEqual(parse(k, { strictNullHandling: true }), { [k]: null });
    assert.deepEqual(parse(k), { [k]: '' });
  }));
});

test('arrayLimit with indices', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 15 }), (lim, idx) => {
    const r = parse(`a[${idx}]=x`, { arrayLimit: lim });
    if (idx <= lim) assert.ok(Array.isArray(r.a) || r.a[idx] === 'x');
    assert.equal(Object.values(r.a).includes('x'), true);
    if (idx < lim) assert.ok(Array.isArray(r.a));
  }));
});

test('charset iso-8859-1 decodes', () => {
  fc.assert(fc.property(fc.integer({ min: 0x20, max: 0xff }), (c) => {
    const ch = String.fromCharCode(c);
    const enc = '%' + c.toString(16).toUpperCase().padStart(2, '0');
    assert.deepEqual(parse('a=' + enc, { charset: 'iso-8859-1' }), { a: ch });
  }));
});
