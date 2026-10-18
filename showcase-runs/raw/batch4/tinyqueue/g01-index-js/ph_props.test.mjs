import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import TinyQueue from '../../../../index.js';

const cmp = (a, b) => a - b;
class Push { constructor(x){this.x=x;} check(){return true;}
  run(m, r){ r.push(this.x); m.push(this.x); m.sort(cmp);
    assert.equal(r.length, m.length); assert.equal(r.peek(), m[0]); }
  toString(){return `push(${this.x})`;} }
class Pop { check(){return true;}
  run(m, r){ const e = m.shift(); assert.equal(r.pop(), e);
    assert.equal(r.length, m.length); assert.equal(r.peek(), m[0]); }
  toString(){return 'pop()';} }

test('model', () => {
  fc.assert(fc.property(fc.commands([fc.integer({min:-20,max:20}).map(x=>new Push(x)), fc.constant(new Pop())], {size:'+1'}),
    (cmds) => { fc.modelRun(() => ({ model: [], real: new TinyQueue([], cmp) }), cmds); }));
});
test('init from array sorts via pops', () => {
  fc.assert(fc.property(fc.array(fc.integer()), (a) => {
    const q = new TinyQueue(a.slice(), cmp); const out = [];
    while (q.length) out.push(q.pop());
    assert.deepEqual(out, a.slice().sort(cmp)); assert.equal(q.pop(), undefined);
  }));
});
test('default compare strings', () => {
  fc.assert(fc.property(fc.array(fc.string()), (a) => {
    const q = new TinyQueue(); a.forEach(x => q.push(x)); const out = [];
    while (q.length) out.push(q.pop());
    assert.deepEqual(out, a.slice().sort((x,y)=>x<y?-1:x>y?1:0));
  }));
});
