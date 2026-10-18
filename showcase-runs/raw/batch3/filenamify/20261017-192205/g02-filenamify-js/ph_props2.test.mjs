import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import filenamify from '../../../../filenamify.js';

const reserved = /[<>:"/\\|?*\u0000-\u001F]/;
const winReserved = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;
const atoms = ['a', 'b', '.', ' ', '/', ':', ' ', 'con', 'nul', 'com1', 'lpt9', 'é', 'é', '😀', '👨‍👩', '​', '\u0000', ' ', '..', 'x.txt', '.txt'];
const str = fc.array(fc.constantFrom(...atoms), {maxLength: 25}).map(a => a.join(''));
const repl = fc.constantFrom('!', '', '_', ' ', '.', 'con', 'a.', '🐴', 'nul ', '‍', 'é');

test('idempotent with options', () => {
	fc.assert(fc.property(str, repl, fc.integer({min: 0, max: 30}), (s, r, m) => {
		const a = filenamify(s, {replacement: r, maxLength: m});
		const b = filenamify(a, {replacement: r, maxLength: m});
		assert.equal(b, a);
	}), {numRuns: 3000});
});

test('invariants with maxLength', () => {
	fc.assert(fc.property(str, repl, fc.integer({min: 0, max: 30}), (s, r, m) => {
		const out = filenamify(s, {replacement: r, maxLength: m});
		assert.ok(!reserved.test(out), JSON.stringify(out));
		assert.ok(!/[. ]$/.test(out), JSON.stringify(out));
		assert.ok(!winReserved.test(out), JSON.stringify(out));
		assert.ok(!/[\p{Control}\p{Zl}\p{Zp}]/u.test(out), JSON.stringify(out));
	}), {numRuns: 3000});
});

test('no control/format chars other than ZWJ', () => {
	fc.assert(fc.property(str, repl, (s, r) => {
		const out = filenamify(s, {replacement: r});
		assert.ok(!/[\p{Control}\p{Format}]/u.test(out.replaceAll('‍', '')), JSON.stringify(out));
	}), {numRuns: 3000});
});

test('result not longer than maxLength without ext/reserved', () => {
	fc.assert(fc.property(str, fc.integer({min: 1, max: 30}), (s, m) => {
		const out = filenamify(s, {maxLength: m});
		fc.pre(!out.includes('.') && !winReserved.test(out) && !/^(con|prn|aux|nul|com\d|lpt\d)/i.test(out));
		assert.ok(out.length <= m, JSON.stringify(out));
	}), {numRuns: 3000});
});
