import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import decamelize from '../../../../index.js';

const ascii = fc.string({unit: fc.constantFrom(...'abcXYZ019_- sS'), maxLength: 20});
const sep = fc.constantFrom('_', '-', ' ', '.', '--');

test('no crash and returns string', () => {
	fc.assert(fc.property(fc.string({unit: 'grapheme', maxLength: 20}), sep, fc.boolean(), (t, s, p) => {
		assert.equal(typeof decamelize(t, {separator: s, preserveConsecutiveUppercase: p}), 'string');
	}));
});

test('lowercase-only input unchanged', () => {
	fc.assert(fc.property(fc.string({unit: fc.constantFrom(...'abcdefg0123 _-'), maxLength: 20}), sep, (t, s) => {
		assert.equal(decamelize(t, {separator: s}), t);
	}));
});

test('removing separator and lowercasing gives same as lowercasing input', () => {
	fc.assert(fc.property(ascii, fc.constantFrom('|', '#'), (t, s) => {
		assert.equal(decamelize(t, {separator: s}).split(s).join(''), t.toLowerCase());
	}));
});

test('preserve=false output has no ASCII uppercase', () => {
	fc.assert(fc.property(ascii, sep, (t, s) => {
		assert.ok(!/[A-Z]/.test(decamelize(t, {separator: s})));
	}));
});

test('preserve=true: removing separator gives input modulo case', () => {
	fc.assert(fc.property(ascii, fc.constantFrom('|', '#'), (t, s) => {
		assert.equal(decamelize(t, {separator: s, preserveConsecutiveUppercase: true}).split(s).join('').toLowerCase(), t.toLowerCase());
	}));
});

test('idempotent (default)', () => {
	fc.assert(fc.property(ascii, (t) => {
		const o = decamelize(t);
		assert.equal(decamelize(o), o);
	}));
});

test('both modes agree on lowercase-folded output when no consecutive uppercase', () => {
	fc.assert(fc.property(fc.string({unit: fc.constantFrom(...'abcXYZ019'), maxLength: 20}), (t) => {
		fc.pre(!/[A-Z]{2}/.test(t));
		assert.equal(decamelize(t, {preserveConsecutiveUppercase: true}).toLowerCase(), decamelize(t));
	}));
});
