import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parseCookie, parseSetCookie, stringifyCookie, stringifySetCookie } from '../../../../src/index.ts';

const nameArb = fc.stringMatching(/^[!#-:<>-~]{1,8}$/);
const valArb = fc.string({ unit: 'binary' }).filter(s => { try { encodeURIComponent(s); return true; } catch { return false; } });
const labelArb = fc.stringMatching(/^[a-z0-9]([a-z0-9-]{0,5}[a-z0-9])?$/);
const domainArb = fc.array(labelArb, { minLength: 1, maxLength: 3 }).map(a => a.join('.'));
const pathArb = fc.stringMatching(/^[ -:=-~]{1,10}$/).filter(s => s === s.trim());

test('cookie roundtrip', () => {
  fc.assert(fc.property(fc.uniqueArray(fc.tuple(nameArb, valArb), { selector: x => x[0] }), (pairs) => {
    const obj = Object.fromEntries(pairs);
    const out = parseCookie(stringifyCookie(obj));
    assert.deepEqual({ ...out }, obj);
  }));
});

test('cookie no crash, string values', () => {
  fc.assert(fc.property(fc.string(), (s) => {
    const r = parseCookie(s);
    for (const k of Object.keys(r)) assert.equal(typeof r[k], 'string');
  }));
});

test('parseCookie agrees with reference', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-c=; \t]{2,14}$/), (s) => {
    const exp =Object.create(null);
    for (const part of s.split(';')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      const k = part.slice(0, i).replace(/^[ \t]+|[ \t]+$/g, '');
      const v = part.slice(i + 1).replace(/^[ \t]+|[ \t]+$/g, '');
      if (!(k in exp)) exp[k] = v;
    }
    assert.deepEqual({ ...parseCookie(s) }, { ...exp });
  }));
});

test('setcookie roundtrip', () => {
  fc.assert(fc.property(nameArb, valArb, fc.option(fc.integer(), { nil: undefined }), fc.option(domainArb, { nil: undefined }),
    fc.option(pathArb, { nil: undefined }), fc.boolean(), fc.boolean(), fc.boolean(),
    fc.option(fc.constantFrom('low', 'medium', 'high'), { nil: undefined }),
    fc.option(fc.constantFrom('lax', 'strict', 'none'), { nil: undefined }),
    fc.option(fc.date({ min: new Date('1970-01-01'), max: new Date('3000-01-01'), noInvalidDate: true }).map(d => new Date(Math.floor(d.getTime() / 1000) * 1000)), { nil: undefined }),
    (name, value, maxAge, domain, path, httpOnly, secure, partitioned, priority, sameSite, expires) => {
      const c = { name, value, maxAge, domain, path, httpOnly, secure, partitioned, priority, sameSite, expires };
      const exp = { name, value };
      for (const [k, v] of Object.entries(c)) if (v !== undefined && v !== false && k !== 'name' && k !== 'value') exp[k] = v;
      assert.deepEqual(parseSetCookie(stringifySetCookie(c)), exp);
    }));
});

test('parseSetCookie no crash', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-zA-Z=; \t-]{0,25}$/), (s) => {
    const r = parseSetCookie(s);
    assert.equal(typeof r.name, 'string');
  }));
});

test('parseSetCookie first segment matches parseCookie', () => {
  fc.assert(fc.property(fc.stringMatching(/^[a-c=; \t]{2,14}$/), (s) => {
    const r = parseSetCookie(s);
    const first = s.split(';')[0];
    if (first.includes('=')) {
      const c = parseCookie(first);
      assert.equal(c[r.name], r.value);
    }
  }));
});
