import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import decamelize from '../../../../index.js';

const uni = fc.string({unit: fc.constantFrom(...'aBcDé É ǅ ǆ ß Σ σ ς İ 1 ٣ s S _ ́ 😀 Ⅳ'.split(' ')), maxLength: 12});

test('idempotent preserve=true', () => {
	fc.assert(fc.property(fc.string({unit: fc.constantFrom(...'abcXYZ019 s'), maxLength: 15}), (t) => {
		const o = decamelize(t, {preserveConsecutiveUppercase: true});
		assert.equal(decamelize(o, {preserveConsecutiveUppercase: true}), o);
	}));
});

test('NFD and NFC give canonically equal result', () => {
	fc.assert(fc.property(uni, (t) => {
		const a = decamelize(t.normalize('NFC'), {separator: '|'});
		const b = decamelize(t.normalize('NFD'), {separator: '|'});
		assert.equal(a.normalize('NFC'), b.normalize('NFC'));
	}));
});

test('unicode: removing sep equals lowercase (non-sigma)', () => {
	fc.assert(fc.property(uni, (t) => {
		fc.pre(!/[Σς]/.test(t));
		assert.equal(decamelize(t, {separator: '|'}).split('|').join(''), t.toLowerCase());
	}));
});

test('separator never at start/end unless input has it', () => {
	fc.assert(fc.property(uni, (t) => {
		fc.pre(!t.includes('|'));
		const o = decamelize(t, {separator: '|'});
		assert.ok(!o.startsWith('|') && !o.endsWith('|') && !o.includes('||'));
	}));
});

test('preserve=true unicode: removing sep equals input modulo case', () => {
	fc.assert(fc.property(uni, (t) => {
		fc.pre(!t.includes('|'));
		const o = decamelize(t, {separator: '|', preserveConsecutiveUppercase: true});
		assert.equal(o.split('|').join('').toLowerCase(), t.toLowerCase());
	}));
});
