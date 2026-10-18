import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parse, format } from '../../../../src/index.ts';

test('format long: plural iff |number|!=1', () => {
  fc.assert(fc.property(fc.integer({min:-1e12,max:1e12}), (n) => {
    const out = format(n, {long:true});
    if (/ ms$/.test(out)) return;
    const num = parseInt(out);
    const plural = /s$/.test(out);
    assert.equal(plural, Math.abs(num) !== 1, out);
  }));
});
test('format symmetric in sign', () => {
  fc.assert(fc.property(fc.integer({min:1,max:1e12}), fc.boolean(), (n, long) => {
    assert.equal(format(-n,{long}), '-'+format(n,{long}));
  }));
});
test('parse numeric roundtrip ms', () => {
  fc.assert(fc.property(fc.integer({min:-1e9,max:1e9}), (n) => {
    assert.equal(parse(String(n)), n);
    assert.equal(parse(n+' ms'), n);
  }));
});
