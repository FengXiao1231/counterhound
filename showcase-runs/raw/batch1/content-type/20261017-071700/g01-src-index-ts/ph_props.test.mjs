import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { format, parse } from '../../../../src/index.ts';

const tchar = fc.constantFrom(...'abcxyzABCXYZ019!#$%&\'*+-.^_`|~');
const token = fc.array(tchar, { minLength: 1, maxLength: 8 }).map(a => a.join(''));
const typeA = fc.tuple(token, token).map(([a, b]) => a + '/' + b);
const vchar = fc.integer({ min: 0, max: 255 }).filter(c => c === 9 || (c >= 32 && c !== 127)).map(c => String.fromCharCode(c));
const value = fc.array(vchar, { maxLength: 12 }).map(a => a.join(''));
const params = fc.uniqueArray(token.map(t => t.toLowerCase()), { maxLength: 4 }).chain(keys =>
  fc.tuple(...keys.map(() => value)).map(vals => Object.fromEntries(keys.map((k, i) => [k, vals[i]]))));

test('roundtrip', () => {
  fc.assert(fc.property(typeA, params, (type, parameters) => {
    const r = parse(format({ type, parameters }));
    assert.equal(r.type, type.toLowerCase());
    assert.deepEqual({ ...r.parameters }, parameters);
  }), { numRuns: 2000 });
});
test('index end', () => {
  fc.assert(fc.property(typeA, params, (type, parameters) => {
    const h = format({ type, parameters });
    assert.equal(parse(h).index, h.length);
  }), { numRuns: 2000 });
});
test('comma option', () => {
  fc.assert(fc.property(typeA, params, typeA, (type, parameters, t2) => {
    const h = format({ type, parameters }) + ', ' + t2;
    const r = parse(h, { comma: true });
    assert.equal(r.type, type.toLowerCase());
    assert.deepEqual({ ...r.parameters }, parameters);
    assert.equal(h[r.index], ',');
  }), { numRuns: 2000 });
});
test('start option', () => {
  fc.assert(fc.property(typeA, params, fc.string({ maxLength: 5 }), (type, parameters, pre) => {
    const h = format({ type, parameters });
    const r = parse(pre + h, { start: pre.length });
    assert.equal(r.type, type.toLowerCase());
    assert.deepEqual({ ...r.parameters }, parameters);
  }), { numRuns: 1000 });
});
test('whitespace tolerant', () => {
  fc.assert(fc.property(typeA, token, token, (type, k, v) => {
    const r = parse(`  ${type} \t;  ${k} =  ${v}  \t`);
    assert.equal(r.type, type.toLowerCase());
    assert.deepEqual({ ...r.parameters }, { [k.toLowerCase()]: v });
  }));
});
test('parameters false', () => {
  fc.assert(fc.property(typeA, params, (type, parameters) => {
    const r = parse(format({ type, parameters }), { parameters: false });
    assert.equal(r.type, type.toLowerCase());
  }));
});
