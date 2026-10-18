import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { swapCase } from '../../../../packages/swap-case/src/index.ts';

test('ascii involution', () => { fc.assert(fc.property(fc.stringMatching(/^[A-Za-z0-9 .\-_]*$/), s => assert.equal(swapCase(swapCase(s)), s))); });
test('per-char concat', () => { fc.assert(fc.property(fc.string({unit:'grapheme'}), fc.string({unit:'grapheme'}), (a,b) => assert.equal(swapCase(a+b), swapCase(a)+swapCase(b)))); });
test('caseless unchanged', () => { fc.assert(fc.property(fc.stringMatching(/^[0-9 .\-_!]*$/), s => assert.equal(swapCase(s), s))); });
test('upper->lower', () => { fc.assert(fc.property(fc.stringMatching(/^[A-Z]*$/), s => assert.equal(swapCase(s), s.toLowerCase()))); });
test('lower->upper', () => { fc.assert(fc.property(fc.stringMatching(/^[a-z]*$/), s => assert.equal(swapCase(s), s.toUpperCase()))); });
test('no crash unicode', () => { fc.assert(fc.property(fc.string({unit:'binary'}), s => { swapCase(s); swapCase(s,'tr'); swapCase(s,['lt','en']); })); });
test('turkish', () => { assert.equal(swapCase('iI','tr'), 'İı'); });
