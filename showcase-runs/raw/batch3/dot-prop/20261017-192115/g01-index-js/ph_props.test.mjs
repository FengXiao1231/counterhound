import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {stringifyPath, parsePath, escapePath, unflatten, hasProperty, deepKeys, getProperty} from '../../../../index.js';

const bad = new Set(['__proto__', 'prototype', 'constructor']);
const keyChars = fc.string({unit: fc.constantFrom('a', 'b', '.', '[', ']', '\\', '0', '1', '9', ' ', 'é', '😀', '-'), maxLength: 6});
const strSeg = keyChars.filter(s => !bad.has(s));
const intSeg = fc.nat(1_000_000);
const seg = fc.oneof(strSeg, intSeg);
const norm = s => typeof s === 'string' && /^(0|[1-9]\d*)$/.test(s) && Number(s) <= 1_000_000 ? Number(s) : s;

test('parse(stringify(segs)) round-trips', () => {
	fc.assert(fc.property(fc.array(seg, {maxLength: 6}), fc.boolean(), (segs, prefer) => {
		fc.pre(segs.length > 0);
		assert.deepEqual(parsePath(stringifyPath(segs, {preferDotForIndices: prefer})), segs.map(norm));
	}), {numRuns: 3000});
});

test('stringify of any finite number segment is parseable', () => {
	fc.assert(fc.property(fc.array(fc.oneof(strSeg, fc.double({noNaN: true, noDefaultInfinity: true})), {minLength: 1, maxLength: 4}), segs => {
		parsePath(stringifyPath(segs));
	}), {numRuns: 2000});
});

test('stringify of any safe integer segment is parseable', () => {
	fc.assert(fc.property(fc.maxSafeNat(), n => {
		parsePath(stringifyPath([n]));
	}));
});

test('escapePath makes string a single literal segment', () => {
	fc.assert(fc.property(strSeg, s => {
		fc.pre(s !== '' && !/^(0|[1-9]\d*)$/.test(s));
		assert.deepEqual(parsePath(escapePath(s)), [s]);
	}), {numRuns: 2000});
});

test('escapePath unescaped equals original', () => {
	fc.assert(fc.property(keyChars, s => {
		assert.equal(escapePath(s).replace(/\\(.)/g, '$1'), s);
	}));
});

test('hasProperty agrees with set paths', () => {
	fc.assert(fc.property(fc.array(strSeg, {minLength: 1, maxLength: 3}), s => {
		fc.pre(s.every(x => x !== ''));
		const o = {};
		let c = o;
		s.forEach((k, i) => { if (i === s.length - 1) c[k] = 1; else { c[k] = {}; c = c[k]; } });
		assert.equal(hasProperty(o, s), true);
		assert.equal(hasProperty(o, stringifyPath(s)), true);
	}));
});

const leaf = fc.oneof(fc.integer(), fc.string(), fc.constant(null), fc.constant([]), fc.constant({}));
const keyArb = fc.string({unit: fc.constantFrom('a', 'b', 'c', '.', '[', ']', '\\', ' '), minLength: 1, maxLength: 3}).filter(k => !bad.has(k));
const tree = fc.letrec(t => ({
	node: fc.oneof({depthSize: 'small'}, leaf, fc.dictionary(keyArb, t('node'), {maxKeys: 3, minKeys: 1})),
})).node;

test('deepKeys paths all resolve via hasProperty', () => {
	fc.assert(fc.property(tree, o => {
		for (const p of deepKeys(o)) {
			assert.equal(hasProperty(o, p), true, p);
		}
	}), {numRuns: 2000});
});

test('unflatten(flatten(tree)) round-trips', () => {
	fc.assert(fc.property(fc.dictionary(keyArb, tree, {minKeys: 1, maxKeys: 3}), o => {
		const flat = {};
		for (const p of deepKeys(o)) flat[p] = getProperty(o, p);
		assert.deepEqual(unflatten(flat), o);
	}), {numRuns: 2000});
});

test('deepKeys with empty-string keys resolve and are unique', () => {
	const k = fc.constantFrom('', 'a', '0', '1');
	const t = fc.letrec(r => ({n: fc.oneof({depthSize: 'small'}, fc.constant(1), fc.dictionary(k, r('n'), {minKeys: 1, maxKeys: 2}), fc.array(r('n'), {minLength: 1, maxLength: 2}))})).n;
	fc.assert(fc.property(t, o => {
		for (const p of deepKeys(o)) assert.equal(hasProperty(o, p), true, JSON.stringify(p));
		const paths = deepKeys(o);
		assert.equal(new Set(paths).size, paths.length);
	}), {numRuns: 3000});
});
