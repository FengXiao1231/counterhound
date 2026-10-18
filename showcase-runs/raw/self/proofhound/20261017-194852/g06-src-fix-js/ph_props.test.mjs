import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makePatch, makeSandbox, changedFiles } from '../../../../src/fix.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ph-'));
const name = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);

test('makeSandbox returns a value (false only when too big)', () => {
  const r = tmp(), d = path.join(tmp(), 'd');
  fs.writeFileSync(path.join(r, 'a.txt'), 'x');
  const res = makeSandbox(r, d);
  assert.notEqual(res, undefined);
});

test('patch headers use a/<f> b/<f> for modified, new, deleted', () => {
  fc.assert(fc.property(name, fc.string(), fc.string(), fc.constantFrom('mod', 'new', 'del'), (n, x, y, kind) => {
    fc.pre(x !== y);
    const r = tmp(), s = tmp();
    const f = n + '.txt';
    if (kind !== 'new') fs.writeFileSync(path.join(r, f), x + '\n');
    if (kind !== 'del') fs.writeFileSync(path.join(s, f), (kind === 'mod' ? y : x) + '\n');
    const p = makePatch(r, s, [f]);
    assert.ok(p.includes(`diff --git a/${f} b/${f}`), p);
    assert.ok(!p.includes(r) && !p.includes(s), p);
    if (kind !== 'new') assert.ok(p.includes(`--- a/${f}`), p);
    if (kind !== 'del') assert.ok(p.includes(`+++ b/${f}`), p);
  }), { numRuns: 30 });
});

test('changedFiles detects modifications/additions/deletions', () => {
  fc.assert(fc.property(fc.uniqueArray(name, { minLength: 1, maxLength: 5 }), fc.array(fc.constantFrom('same', 'mod', 'del'), { minLength: 5, maxLength: 5 }), (names, ks) => {
    const r = tmp(), s = tmp();
    const exp = [];
    names.forEach((n, i) => {
      const f = `sub/${n}.txt`;
      fs.mkdirSync(path.join(r, 'sub'), { recursive: true }); fs.mkdirSync(path.join(s, 'sub'), { recursive: true });
      fs.writeFileSync(path.join(r, f), 'a');
      if (ks[i] === 'same') fs.writeFileSync(path.join(s, f), 'a');
      else if (ks[i] === 'mod') { fs.writeFileSync(path.join(s, f), 'b'); exp.push(f); }
      else exp.push(f);
    });
    fs.writeFileSync(path.join(s, 'new.txt'), 'n'); exp.push('new.txt');
    assert.deepEqual(changedFiles(r, s), exp.sort());
  }), { numRuns: 30 });
});

test('sandbox copy then changedFiles is empty; skips dirs', () => {
  const r = tmp(), d = path.join(tmp(), 'd');
  fs.mkdirSync(path.join(r, 'src')); fs.writeFileSync(path.join(r, 'src/a.js'), '1');
  fs.mkdirSync(path.join(r, 'node_modules/x'), { recursive: true }); fs.writeFileSync(path.join(r, 'node_modules/x/i.js'), '1');
  fs.mkdirSync(path.join(r, 'build')); fs.writeFileSync(path.join(r, 'build/o'), '1');
  makeSandbox(r, d);
  assert.ok(fs.existsSync(path.join(d, 'node_modules/x/i.js')));
  assert.ok(!fs.existsSync(path.join(d, 'build')));
  assert.deepEqual(changedFiles(r, d), []);
});

test('patch for file whose path contains spaces', () => {
  const r = tmp(), s = tmp();
  fs.writeFileSync(path.join(r, 'a b.txt'), 'x\n'); fs.writeFileSync(path.join(s, 'a b.txt'), 'y\n');
  const p = makePatch(r, s, ['a b.txt']);
  assert.ok(p.includes('+++ b/a b.txt'), p);
});
