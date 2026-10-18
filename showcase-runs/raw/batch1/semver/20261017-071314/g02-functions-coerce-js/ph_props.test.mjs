import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import coerce from '../../../../functions/coerce.js';
import SemVer from '../../../../classes/semver.js';

const num = fc.nat({ max: 100000 });
const ver = fc.tuple(num, num, num).map(([a, b, c]) => `${a}.${b}.${c}`);
const nodigit = fc.string().map(s => s.replace(/\d/g, 'x'));

test('valid semver coerces to itself', () => {
  fc.assert(fc.property(ver, v => { assert.equal(coerce(v).version, v); }));
});
test('surrounding non-digit text ignored', () => {
  fc.assert(fc.property(nodigit, ver, nodigit, (p, v, s) => {
    fc.pre(!s.startsWith('.'));
    assert.equal(coerce(p + v + s).version, v);
  }));
});
test('partial versions pad zeros', () => {
  fc.assert(fc.property(num, num, (a, b) => {
    assert.equal(coerce(`${a}`).version, `${a}.0.0`);
    assert.equal(coerce(`v${a}.${b}`).version, `${a}.${b}.0`);
  }));
});
test('number input', () => {
  fc.assert(fc.property(num, a => { assert.equal(coerce(a).version, `${a}.0.0`); }));
});
test('no digits -> null', () => {
  fc.assert(fc.property(nodigit, s => { assert.equal(coerce(s), null); assert.equal(coerce(s, { rtl: true }), null); }));
});
test('non-string -> null', () => {
  for (const x of [null, undefined, {}, [], true]) assert.equal(coerce(x), null);
});
test('SemVer instance returned as-is', () => {
  const s = new SemVer('1.2.3'); assert.equal(coerce(s), s);
});
test('rtl on valid version equals itself', () => {
  fc.assert(fc.property(ver, v => { assert.equal(coerce(v, { rtl: true }).version, v); }));
});
test('rtl: 4 components takes last three', () => {
  fc.assert(fc.property(num, num, num, num, (a, b, c, d) => {
    assert.equal(coerce(`${a}.${b}.${c}.${d}`, { rtl: true }).version, `${b}.${c}.${d}`);
    assert.equal(coerce(`${a}.${b}.${c}.${d}`).version, `${a}.${b}.${c}`);
  }));
});
test('rtl with slash picks right-most', () => {
  fc.assert(fc.property(ver, num, (v, d) => {
    assert.equal(coerce(`${v}/${d}`, { rtl: true }).version, `${d}.0.0`);
  }));
});
test('rtl repeated calls stable (regex state)', () => {
  fc.assert(fc.property(fc.string(), s => {
    const a = coerce(s, { rtl: true }); const b = coerce(s, { rtl: true });
    assert.equal(a && a.version, b && b.version);
  }));
});
test('rtl and ltr agree on coercibility', () => {
  fc.assert(fc.property(fc.stringMatching(/^[0-9a-z.\-+\/ ]{0,30}$/), s => {
    const r = coerce(s, { rtl: true }); const l = coerce(s);
    assert.equal(r === null, l === null);
  }));
});
test('includePrerelease keeps prerelease and build', () => {
  const id = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
  fc.assert(fc.property(ver, id, id, (v, p, b) => {
    const r = coerce(`${v}-${p}+${b}`, { includePrerelease: true });
    assert.equal(r.version, `${v}-${p}`);
    assert.deepEqual(r.build, [b]);
    assert.deepEqual(r.prerelease, [p]);
    assert.equal(coerce(`${v}-${p}+${b}`).version, v);
  }));
});
test('includePrerelease rtl', () => {
  const id = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
  fc.assert(fc.property(num, ver, id, (a, v, p) => {
    const r = coerce(`${a}.${v}-${p}`, { includePrerelease: true, rtl: true });
    assert.equal(r.version, `${v.split('.').slice(0, 3).join('.')}-${p}`);
  }));
});
test('long component ignored', () => {
  assert.equal(coerce('10000000000000000.4.7.4').version, '4.7.4');
});
test('never throws on arbitrary strings', () => {
  fc.assert(fc.property(fc.string({ maxLength: 60 }), fc.boolean(), fc.boolean(), (s, rtl, ip) => {
    const r = coerce(s, { rtl, includePrerelease: ip });
    assert.ok(r === null || r instanceof SemVer);
  }));
});
