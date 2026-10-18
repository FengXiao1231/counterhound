import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import parse from '../../../../index.js';
const units = ['ns','us','ms','s','m','h','d','w','mo','y','sec','min','hr','day','week','year','hours','minutes'];
const close=(a,b)=>Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
test('single unit n*unit', () => { fc.assert(fc.property(fc.integer({min:0,max:100000}), fc.constantFrom(...units), fc.constantFrom('',' '), (n,u,sp)=>{
  assert.ok(close(parse(n+sp+u), n*parse('1'+u)));
}))});
test('negative sign applies with noise prefix', () => { fc.assert(fc.property(fc.integer({min:1,max:1000}), fc.constantFrom('h','m','s'), fc.constantFrom('duration: ','about ','x '), (n,u,pre)=>{
  assert.ok(parse(pre+'-'+n+u) < 0);
}))});
test('negation of leading minus', () => { fc.assert(fc.property(fc.integer({min:1,max:1000}), fc.constantFrom(...units), (n,u)=>{
  assert.equal(parse('-'+n+u), -parse(n+u));
}))});
test('format conversion', () => { fc.assert(fc.property(fc.integer({min:1,max:1000}), fc.constantFrom(...units), fc.constantFrom(...units), (n,u,f)=>{
  assert.ok(close(parse(n+u,f), parse(n+u)/parse('1'+f)));
}))});
test('compound sums', () => { fc.assert(fc.property(fc.integer({min:0,max:1000}), fc.integer({min:0,max:1000}), (a,b)=>{
  assert.ok(close(parse(`${a}h ${b}m`), a*3600000+b*60000));
  assert.ok(close(parse(`${a}h${b}m`), a*3600000+b*60000));
  assert.ok(close(parse(`${a}h${b}`), a*3600000+b*60000));
}))});
test('case-insensitive', () => { fc.assert(fc.property(fc.integer({min:0,max:1000}), fc.constantFrom(...units), (n,u)=>{
  assert.equal(parse(n+u.toUpperCase()), parse(n+u));
}))});
test('zero', () => { fc.assert(fc.property(fc.constantFrom(...units), (u)=>{
  assert.equal(parse('0'+u), 0);
}))});
test('no digits -> null', () => { fc.assert(fc.property(fc.stringMatching(/^[a-z ]{0,10}$/), (s)=>{
  assert.equal(parse(s), null);
}))});
test('decimals', () => { fc.assert(fc.property(fc.integer({min:0,max:1000}), fc.integer({min:0,max:999}), (a,b)=>{
  assert.ok(close(parse(`${a}.${b}s`), Number(`${a}.${b}`)*1000));
}))});
