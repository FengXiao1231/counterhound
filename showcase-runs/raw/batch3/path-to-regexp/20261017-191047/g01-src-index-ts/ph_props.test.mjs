import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parse, stringify, TokenData } from '../../../../src/index.ts';

const chars = fc.constantFrom('a','b','Z','0','_','$','/','-','.',':','*','{','}','(',')','[',']','+','?','!','\\','"',' ','\n','‌','😀','é','\u{1D7D8}','́');
const str = fc.array(chars, { maxLength: 12 }).map((a) => a.join(''));
const textArb = fc.array(chars, { minLength: 1, maxLength: 5 }).map((a) => a.join(''));
const nameArb = fc.array(chars, { minLength: 1, maxLength: 5 }).map((a) => a.join(''));

const tok = fc.letrec((t) => ({
  token: fc.oneof(
    { depth: 2 },
    fc.record({ type: fc.constant('text'), value: textArb }),
    fc.record({ type: fc.constant('param'), name: nameArb }),
    fc.record({ type: fc.constant('wildcard'), name: nameArb }),
    fc.record({ type: fc.constant('group'), tokens: fc.array(t('token'), { maxLength: 3 }) }),
  ),
})).token;

function norm(tokens) {
  const out = [];
  for (const t of tokens) {
    const c = t.type === 'group' ? { type: 'group', tokens: norm(t.tokens) } : t;
    const last = out[out.length - 1];
    if (c.type === 'text' && last && last.type === 'text') last.value += c.value;
    else out.push({ ...c });
  }
  return out;
}

test('parse->stringify->parse stable', () => {
  fc.assert(fc.property(str, (s) => {
    let d;
    try { d = parse(s); } catch { fc.pre(false); }
    const s2 = stringify(d);
    assert.deepEqual(parse(s2).tokens, d.tokens);
  }), { numRuns: 20000 });
});

test('stringify->parse gives tokens (modulo text merge)', () => {
  fc.assert(fc.property(fc.array(tok, { maxLength: 4 }), (tokens) => {
    const s = stringify(new TokenData(tokens));
    assert.deepEqual(parse(s).tokens, norm(tokens));
  }), { numRuns: 20000 });
});

test('stringify idempotent', () => {
  fc.assert(fc.property(str, (s) => {
    let d;
    try { d = parse(s); } catch { fc.pre(false); }
    const s2 = stringify(d);
    assert.equal(stringify(parse(s2)), s2);
  }), { numRuns: 10000 });
});

test('parse errors are PathError only', () => {
  fc.assert(fc.property(str, (s) => {
    try { parse(s); } catch (e) { assert.equal(e.name === 'TypeError' || e instanceof TypeError, true); assert.match(e.message, /visit https/); }
  }), { numRuns: 10000 });
});

test('escaped text parses to literal', () => {
  fc.assert(fc.property(textArb, (t) => {
    const d = parse(stringify(new TokenData([{ type: 'text', value: t }])));
    assert.deepEqual(d.tokens, [{ type: 'text', value: t }]);
  }), { numRuns: 10000 });
});
