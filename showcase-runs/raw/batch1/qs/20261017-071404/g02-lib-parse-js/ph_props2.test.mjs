import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import parse from '../../../../lib/parse.js';

const word = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const val = fc.stringMatching(/^[a-z0-9]{1,4}$/);

test('comma + iso + interpretNumericEntities keeps array', () => {
  fc.assert(fc.property(word, fc.array(val, { minLength: 2, maxLength: 4 }), (k, vs) => {
    const r = parse(k + '=' + vs.join(','), { comma: true, charset: 'iso-8859-1', interpretNumericEntities: true });
    assert.deepEqual(r, { [k]: vs });
  }));
});

test('numeric entities decoded', () => {
  fc.assert(fc.property(word, fc.integer({ min: 1, max: 0xffff }), (k, n) => {
    const r = parse(k + '=%26%23' + n + '%3B', { charset: 'iso-8859-1', interpretNumericEntities: true });
    assert.deepEqual(r, { [k]: String.fromCharCode(n) });
  }));
});

test('throwOnLimitExceeded repeated []', () => {
  fc.assert(fc.property(word, fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 10 }), (k, lim, n) => {
    const str = Array.from({ length: n }, () => k + '[]=x').join('&');
    if (n > lim) assert.throws(() => parse(str, { arrayLimit: lim, throwOnLimitExceeded: true }), RangeError);
    else assert.deepEqual(parse(str, { arrayLimit: lim, throwOnLimitExceeded: true }), { [k]: Array(n).fill('x') });
  }));
});

test('throwOnLimitExceeded duplicate keys', () => {
  fc.assert(fc.property(word, fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 10 }), (k, lim, n) => {
    const str = Array.from({ length: n }, () => k + '=x').join('&');
    if (n > lim) assert.throws(() => parse(str, { arrayLimit: lim, throwOnLimitExceeded: true }), RangeError);
    else assert.doesNotThrow(() => parse(str, { arrayLimit: lim, throwOnLimitExceeded: true }));
  }));
});

test('comma limit', () => {
  fc.assert(fc.property(word, fc.integer({ min: 1, max: 6 }), fc.integer({ min: 2, max: 10 }), (k, lim, n) => {
    const str = k + '=' + Array(n).fill('x').join(',');
    if (n > lim) assert.throws(() => parse(str, { comma: true, arrayLimit: lim, throwOnLimitExceeded: true }), RangeError);
    else assert.deepEqual(parse(str, { comma: true, arrayLimit: lim, throwOnLimitExceeded: true }), { [k]: Array(n).fill('x') });
  }));
});

test('parseArrays false never yields arrays', () => {
  const isArr = (v) => Array.isArray(v) || (v && typeof v === 'object' && Object.values(v).some(isArr));
  fc.assert(fc.property(fc.array(fc.tuple(word, fc.constantFrom('', '[]', '[0]', '[1]', '[a]', '[a][]', '[][b]'), val), { maxLength: 5 }), (ps) => {
    const str = ps.map(([a, b, c]) => a + b + '=' + c).join('&');
    assert.equal(isArr(parse(str, { parseArrays: false })), false);
  }));
});

test('parseArrays false: a[0]=x -> {a:{0:x}}', () => {
  fc.assert(fc.property(word, fc.integer({ min: 0, max: 15 }), val, (k, i, v) => {
    assert.deepEqual(parse(`${k}[${i}]=${v}`, { parseArrays: false }), { [k]: { [i]: v } });
  }));
});

test('allowEmptyArrays', () => {
  fc.assert(fc.property(word, (k) => {
    assert.deepEqual(parse(k + '[]=', { allowEmptyArrays: true }), { [k]: [] });
    assert.deepEqual(parse(k + '[]=', {}), { [k]: [''] });
  }));
});

test('decodeDotInKeys', () => {
  fc.assert(fc.property(word, word, word, val, (a, b, c, v) => {
    assert.deepEqual(parse(`${a}%252E${b}.${c}=${v}`, { decodeDotInKeys: true }), { [a + '.' + b]: { [c]: v } });
    assert.deepEqual(parse(`${a}[${b}%252E${c}]=${v}`, { decodeDotInKeys: true }), { [a]: { [b + '.' + c]: v } });
  }));
});

test('charsetSentinel', () => {
  fc.assert(fc.property(word, fc.constantFrom('%E2%9C%93', '%26%2310003%3B'), (k, s) => {
    const r = parse(`utf8=${s}&${k}=%E4`, { charsetSentinel: true });
    const exp = s === '%E2%9C%93' ? '�' : 'ä';
    assert.deepEqual(Object.keys(r), [k]);
  }));
  assert.deepEqual(parse('a=%E4&utf8=%26%2310003%3B', { charsetSentinel: true }), { a: 'ä' });
});

test('delimiter variants', () => {
  fc.assert(fc.property(fc.uniqueArray(word, { minLength: 1, maxLength: 5 }), fc.constantFrom(';', '|', ', '), (ks, d) => {
    const exp = Object.fromEntries(ks.map((k) => [k, '1']));
    assert.deepEqual(parse(ks.map((k) => k + '=1').join(d), { delimiter: d }), exp);
  }));
  fc.assert(fc.property(fc.uniqueArray(word, { minLength: 1, maxLength: 5 }), (ks) => {
    const exp = Object.fromEntries(ks.map((k) => [k, '1']));
    assert.deepEqual(parse(ks.map((k) => k + '=1').join(';'), { delimiter: /[;,]/ }), exp);
  }));
});

test('plainObjects allows keys like hasOwnProperty', () => {
  fc.assert(fc.property(fc.constantFrom('hasOwnProperty', 'toString', 'constructor'), val, (k, v) => {
    const r = parse(`${k}=${v}&x[${k}]=${v}`, { plainObjects: true });
    assert.equal(r[k], v);
    assert.equal(r.x[k], v);
    assert.equal(Object.getPrototypeOf(r), null);
  }));
});

test('allowPrototypes', () => {
  fc.assert(fc.property(fc.constantFrom('hasOwnProperty', 'toString', 'constructor'), val, (k, v) => {
    const r = parse(`${k}=${v}`, { allowPrototypes: true });
    assert.equal(Object.prototype.hasOwnProperty.call(r, k), true);
    assert.equal(Object.keys(parse(`${k}=${v}`)).length, 0);
  }));
});

test('key with encoded brackets equals literal', () => {
  fc.assert(fc.property(word, word, val, (a, b, v) => {
    assert.deepEqual(parse(`${a}%5B${b}%5D=${v}`), parse(`${a}[${b}]=${v}`));
    assert.deepEqual(parse(`${a}%5b${b}%5d=${v}`), parse(`${a}[${b}]=${v}`));
  }));
});

test('depth 0 / false keeps flat key', () => {
  fc.assert(fc.property(word, word, val, (a, b, v) => {
    assert.deepEqual(parse(`${a}[${b}]=${v}`, { depth: 0 }), { [`${a}[${b}]`]: v });
    assert.deepEqual(parse(`${a}[${b}]=${v}`, { depth: false }), { [`${a}[${b}]`]: v });
  }));
});

test('sparse arrays compacted; allowSparse keeps holes', () => {
  fc.assert(fc.property(word, fc.uniqueArray(fc.integer({ min: 0, max: 15 }), { minLength: 1, maxLength: 5 }), (k, idxs) => {
    const str = idxs.map((i) => `${k}[${i}]=v${i}`).join('&');
    const sorted = [...idxs].sort((a, b) => a - b);
    const compact = parse(str);
    assert.deepEqual(compact, { [k]: sorted.map((i) => 'v' + i) });
    const sparse = parse(str, { allowSparse: true });
    for (const i of idxs) assert.equal(sparse[k][i], 'v' + i);
  }));
});

test('mixed array and object on same key', () => {
  fc.assert(fc.property(word, word, val, val, (k, s, v1, v2) => {
    const r = parse(`${k}[]=${v1}&${k}[${s}]=${v2}`);
    assert.ok(Object.values(r[k]).includes(v1) && Object.values(r[k]).includes(v2) || (Array.isArray(r[k]) && r[k].includes(v1)));
  }));
});

test('object input deep nested equals string input', () => {
  fc.assert(fc.property(word, word, word, val, (a, b, c, v) => {
    assert.deepEqual(parse({ [`${a}[${b}][${c}]`]: v }), parse(`${a}[${b}][${c}]=${v}`));
    assert.deepEqual(parse({ [`${a}[]`]: [v, v] }), { [a]: [v, v] });
  }));
});
