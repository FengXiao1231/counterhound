import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import inc from '../../../../functions/inc.js';
import SemVer from '../../../../classes/semver.js';
import gt from '../../../../functions/gt.js';
import valid from '../../../../functions/valid.js';

const n = fc.integer({ min: 0, max: 1000 });
const pre = fc.array(fc.oneof(n, fc.stringMatching(/^[a-zA-Z-][a-zA-Z0-9-]{0,5}$/)), { maxLength: 3 });
const ver = fc.record({ a: n, b: n, c: n, p: pre }).map(({ a, b, c, p }) => `${a}.${b}.${c}${p.length ? '-' + p.join('.') : ''}`);
const rel = fc.constantFrom('major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease');
const ident = fc.option(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,5}$/), { nil: undefined });

test('plain bumps', () => {
  fc.assert(fc.property(n, n, n, (a, b, c) => {
    assert.equal(inc(`${a}.${b}.${c}`, 'major'), `${a + 1}.0.0`);
    assert.equal(inc(`${a}.${b}.${c}`, 'minor'), `${a}.${b + 1}.0`);
    assert.equal(inc(`${a}.${b}.${c}`, 'patch'), `${a}.${b}.${c + 1}`);
  }));
});
test('result valid and greater', () => {
  fc.assert(fc.property(ver, rel, ident, fc.constantFrom(undefined, '0', '1', false), (v, r, id, base) => {
    fc.pre(!(base === false && !id && r.startsWith('pre')));
    const out = inc(v, r, {}, id, base);
    assert.notEqual(out, null);
    assert.equal(valid(out), out);
    if (id === undefined) assert.ok(gt(out, v), `${out} > ${v}`);
  }));
});
test('string options shifts args', () => {
  fc.assert(fc.property(ver, rel, ident, (v, r, id) => {
    assert.equal(inc(v, r, id), inc(v, r, undefined, id));
  }));
});
test('SemVer instance not mutated', () => {
  fc.assert(fc.property(ver, rel, ident, (v, r, id) => {
    const s = new SemVer(v);
    inc(s, r, id);
    assert.equal(s.version, v);
  }));
});
test('release strips prerelease', () => {
  fc.assert(fc.property(n, n, n, pre, (a, b, c, p) => {
    fc.pre(p.length > 0);
    assert.equal(inc(`${a}.${b}.${c}-${p.join('.')}`, 'release'), `${a}.${b}.${c}`);
  }));
});
test('prerelease twice monotonic', () => {
  fc.assert(fc.property(ver, ident, (v, id) => {
    const a = inc(v, 'prerelease', id);
    const b = inc(a, 'prerelease', id);
    assert.ok(gt(b, a));
  }));
});
