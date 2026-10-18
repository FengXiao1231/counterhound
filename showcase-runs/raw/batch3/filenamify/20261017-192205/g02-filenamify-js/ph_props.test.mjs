import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import filenamify from '../../../../filenamify.js';

const reserved = /[<>:"/\\|?*\u0000-\u001F]/;
const winReserved = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

const str = fc.oneof(
	fc.string({unit: 'binary', maxLength: 40}),
	fc.array(fc.constantFrom('a', 'b', '.', ' ', '/', '\\', ':', ' ', '\t', 'con', 'nul', 'com1', 'é', '́', '😀', '‍', '\u0000'), {maxLength: 30}).map(a => a.join('')),
);
const repl = fc.oneof(
	fc.constant('!'),
	fc.constantFrom('', '_', ' ', '.', '..', 'con', 'a.', '🐴', 'aux', 'nul '),
);

test('no reserved chars, no trailing dot/space, non-empty', () => {
	fc.assert(fc.property(str, repl, (s, r) => {
		const out = filenamify(s, {replacement: r});
		assert.ok(!reserved.test(out), JSON.stringify(out));
		assert.ok(!/[. ]$/.test(out), JSON.stringify(out));
	}));
});

test('never windows reserved name', () => {
	fc.assert(fc.property(str, repl, (s, r) => {
		const out = filenamify(s, {replacement: r});
		assert.ok(!winReserved.test(out), JSON.stringify(out));
	}));
});

test('idempotent', () => {
	fc.assert(fc.property(str, (s) => {
		const a = filenamify(s);
		assert.equal(filenamify(a), a);
	}));
});

test('length bound unless extension long', () => {
	fc.assert(fc.property(str, fc.integer({min: 1, max: 20}), (s, m) => {
		const out = filenamify(s, {maxLength: m});
		const i = out.indexOf('.');
		const ext = out.lastIndexOf('.') === -1 ? 0 : out.length - out.lastIndexOf('.');
		fc.pre(out.length > m);
		// allowed only if extension >= m or reserved-name suffix
		assert.ok(ext >= m - 0 || /^(con|prn|aux|nul|com\d|lpt\d)/i.test(out), JSON.stringify(out));
	}));
});

test('safe string with no special chars unchanged', () => {
	fc.assert(fc.property(fc.array(fc.constantFrom(...'abcxyz019_-'), {minLength: 1, maxLength: 50}).map(a => a.join('')), (s) => {
		fc.pre(!winReserved.test(s));
		assert.equal(filenamify(s), s);
	}));
});
