import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import stringify from '../../../../lib/stringify.js';
import qs from '../../../../lib/index.js';

const key = fc.stringMatching(/^[a-z]{1,4}$/);
const val = fc.oneof(fc.stringMatching(/^[a-z0-9 ]{0,5}$/), fc.integer(), fc.boolean());
const flat = fc.dictionary(key, val);

test('filter array not mutated when sort given', () => {
  fc.assert(fc.property(fc.uniqueArray(key, { minLength: 2, maxLength: 5 }), (keys) => {
    const filter = keys.slice(); const copy = keys.slice();
    const o = {}; keys.forEach((k) => { o[k] = 1; });
    stringify(o, { filter, sort: (a, b) => a.localeCompare(b) });
    assert.deepEqual(filter, copy);
  }));
});

test('round trip flat', () => {
  fc.assert(fc.property(flat, (o) => {
    const parsed = qs.parse(stringify(o));
    const exp = {}; for (const k of Object.keys(o)) exp[k] = String(o[k]);
    assert.deepEqual(parsed, exp);
  }));
});

test('round trip nested arrays all formats', () => {
  fc.assert(fc.property(fc.dictionary(key, fc.array(fc.stringMatching(/^[a-z0-9]{1,4}$/), { minLength: 2, maxLength: 4 })), fc.constantFrom('indices', 'brackets', 'repeat', 'comma'), fc.boolean(), (o, arrayFormat, evo) => {
    const s = stringify(o, { arrayFormat, encodeValuesOnly: evo });
    const p = qs.parse(s, { comma: arrayFormat === 'comma' });
    assert.deepEqual(p, o);
  }));
});

test('skipNulls drops nulls', () => {
  fc.assert(fc.property(fc.dictionary(key, fc.option(val)), (o) => {
    const s = stringify(o, { skipNulls: true });
    for (const k of Object.keys(o)) if (o[k] === null) assert.ok(!s.split('&').some((p) => p.split('=')[0] === k));
  }));
});

test('addQueryPrefix and delimiter', () => {
  fc.assert(fc.property(flat, (o) => {
    const a = stringify(o, { delimiter: ';' });
    const b = stringify(o, { addQueryPrefix: true, delimiter: ';' });
    assert.equal(b, a ? '?' + a : '');
    assert.equal(a.split(';').filter(Boolean).length, Object.keys(o).length);
  }));
});

test('nested round trip with allowDots + encodeDotInKeys', () => {
  fc.assert(fc.property(fc.dictionary(fc.stringMatching(/^[a-z.]{1,4}$/), fc.stringMatching(/^[a-z]{0,3}$/)), (o) => {
    const p = qs.parse(stringify(o, { allowDots: true, encodeDotInKeys: true }), { allowDots: true, decodeDotInKeys: true });
    assert.deepEqual(p, o);
  }));
});

test('sort order of keys', () => {
  fc.assert(fc.property(flat, (o) => {
    const s = stringify(o, { sort: (a, b) => a.localeCompare(b) });
    const ks = s ? s.split('&').map((p) => decodeURIComponent(p.split('=')[0])) : [];
    assert.deepEqual(ks, ks.slice().sort((a, b) => a.localeCompare(b)));
  }));
});

test('comma single roundtrip', () => {
  fc.assert(fc.property(key, fc.stringMatching(/^[a-z0-9]{1,4}$/), (k, v) => {
    const p = qs.parse(stringify({ [k]: [v] }, { arrayFormat: 'comma', commaRoundTrip: true }), { comma: true });
    assert.deepEqual(p, { [k]: [v] });
  }));
});
