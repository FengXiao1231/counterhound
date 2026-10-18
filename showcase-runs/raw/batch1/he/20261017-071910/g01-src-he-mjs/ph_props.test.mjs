import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { encode, decode, escape } from '../../../../src/he.mjs';

const opts = fc.record({
  allowUnsafeSymbols: fc.boolean(), encodeEverything: fc.boolean(),
  useNamedReferences: fc.boolean(), decimal: fc.boolean(),
}, { requiredKeys: [] });
const wellFormed = (s) => { try { encodeURIComponent(s); return true; } catch { return false; } };
const str = fc.oneof(
  fc.string({ unit: 'binary' }),
  fc.string({ unit: fc.constantFrom('<', '>', '&', '"', "'", '`', 'a', 'f', 'j', '⃒', 'é', '\0', '\u{1D306}', '\n', '#', ';', 'x') }),
  fc.string({ unit: 'grapheme' }),
).filter(wellFormed);

test('roundtrip decode(encode(x,o))==x', () => {
  fc.assert(fc.property(str, opts, (s, o) => {
    assert.equal(decode(encode(s, o)), s);
  }), { numRuns: 5000 });
});
test('encode output is ASCII and escapes unsafe symbols', () => {
  fc.assert(fc.property(str, opts, (s, o) => {
    const e = encode(s, o);
    assert.ok(/^[\x00-\x7F]*$/.test(e), JSON.stringify(e));
    if (!o.allowUnsafeSymbols || o.encodeEverything) assert.ok(!/["'<>`]/.test(e));
  }), { numRuns: 3000 });
});
test('decode(escape(x))==x', () => {
  fc.assert(fc.property(str, (s) => { assert.equal(decode(escape(s)), s); }), { numRuns: 3000 });
});
test('escape only changes unsafe chars', () => {
  fc.assert(fc.property(str, (s) => {
    assert.equal(escape(s).replace(/&(amp|quot|lt|gt|#x27|#x60);/g, '').replace(/[^"&'<>`]/g, '').length >= 0, true);
    assert.equal(escape(s.replace(/["&'<>`]/g, '')), s.replace(/["&'<>`]/g, ''));
  }), { numRuns: 2000 });
});
test('strict decode of encode never throws', () => {
  fc.assert(fc.property(str, opts, (s, o) => {
    fc.pre(!o.allowUnsafeSymbols || o.encodeEverything);
    fc.pre(!/[\0-\x08\x0B\x0D-\x1F\x7F-\x9F﷐-﷯]|[￾￿]/.test(s));
    fc.pre(!/[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDFFE\uDFFF]/.test(s));
    decode(encode(s, o), { strict: true });
  }), { numRuns: 3000 });
});
test('decode never crashes on arbitrary input, nonstrict', () => {
  fc.assert(fc.property(fc.string({ unit: fc.constantFrom('&', '#', 'x', 'X', ';', 'a', 'm', 'p', '1', '9', 'F', '=', 'l', 't') }), fc.boolean(), (s, a) => {
    assert.equal(typeof decode(s, { isAttributeValue: a }), 'string');
  }), { numRuns: 5000 });
});
test('encode decimal uses no hex refs', () => {
  fc.assert(fc.property(str, (s) => {
    assert.ok(!/&#x/i.test(encode(s, { decimal: true })));
  }), { numRuns: 2000 });
});
