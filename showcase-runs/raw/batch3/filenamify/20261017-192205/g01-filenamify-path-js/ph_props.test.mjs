import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import path from 'node:path';
import filenamify from '../../../../filenamify.js';
import fp from '../../../../filenamify-path.js';
const seg = fc.string({minLength: 1, maxLength: 20}).filter(s => !s.includes('/') && !s.includes('\0'));
test('dirname preserved', () => { fc.assert(fc.property(fc.array(seg, {minLength: 1, maxLength: 4}), segs => {
	const p = '/' + segs.join('/'); assert.equal(path.dirname(fp(p)), path.dirname(path.resolve(p)));
})); });
test('basename equals filenamify', () => { fc.assert(fc.property(fc.array(seg, {minLength: 1, maxLength: 4}), segs => {
	const p = '/' + segs.join('/'); assert.equal(path.basename(fp(p)), filenamify(path.basename(path.resolve(p))));
})); });
test('idempotent', () => { fc.assert(fc.property(fc.array(seg, {minLength: 1, maxLength: 3}), segs => {
	const p = '/' + segs.join('/'); const a = fp(p); assert.equal(fp(a), a);
})); });
test('relative input', () => { fc.assert(fc.property(seg, s => {
	const r = fp(s); assert.equal(path.dirname(r), path.dirname(path.resolve(s)));
})); });
