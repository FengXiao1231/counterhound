import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import p from '../../../../index.js';

const D = 86400000;
const intMs = fc.integer({min: 0, max: 2 ** 40});
const flag = fc.boolean();
const opts = fc.record({
	verbose: flag, compact: flag, hideYear: flag, hideYearAndDays: flag, hideSeconds: flag,
	separateMilliseconds: flag, formatSubMilliseconds: flag, subSecondsAsDecimals: flag,
	keepDecimalsOnWholeSeconds: flag, colonNotation: flag,
	secondsDecimalDigits: fc.integer({min: 0, max: 4}),
	millisecondsDecimalDigits: fc.integer({min: 0, max: 4}),
	unitCount: fc.option(fc.integer({min: 1, max: 6}), {nil: undefined}),
}, {requiredKeys: []});

test('default integer output matches reference', () => {
	fc.assert(fc.property(intMs, ms => {
		const parts = [];
		const y = Math.floor(ms / D / 365);
		const d = Math.floor(ms / D) % 365;
		const h = Math.floor(ms / 3600000) % 24;
		const m = Math.floor(ms / 60000) % 60;
		if (y) parts.push(y + 'y');
		if (d) parts.push(d + 'd');
		if (h) parts.push(h + 'h');
		if (m) parts.push(m + 'm');
		if (ms < 1000) {
			if (ms) parts.push(ms + 'ms');
		} else {
			const tenths = Math.floor((ms % 60000) / 100);
			const s = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
			if (tenths) parts.push(s + 's');
		}
		assert.equal(p(ms), parts.length ? parts.join(' ') : '0ms');
	}));
});

test('bigint equals number for integers, any options', () => {
	fc.assert(fc.property(intMs, opts, (ms, o) => {
		assert.equal(p(BigInt(ms), o), p(ms, o));
	}));
});

test('negation only adds a minus sign', () => {
	fc.assert(fc.property(intMs, opts, (ms, o) => {
		const a = p(ms, o);
		const b = p(-ms, o);
		assert.ok(b === a || b === '-' + a, `${a} vs ${b}`);
	}));
});

test('never crashes and no NaN/undefined', () => {
	fc.assert(fc.property(fc.double({min: 0, max: 1e13, noNaN: true}), opts, (ms, o) => {
		const r = p(ms, o);
		assert.ok(!/NaN|undefined|Infinity|e\+|e-/.test(r), r);
		assert.ok(r.length > 0);
	}));
});

test('unitCount limits number of units', () => {
	fc.assert(fc.property(intMs, fc.integer({min: 1, max: 5}), (ms, n) => {
		const r = p(ms, {unitCount: n});
		assert.ok(r.split(' ').length <= n);
		assert.ok(p(ms).startsWith(r));
	}));
});

test('colon notation fields', () => {
	fc.assert(fc.property(intMs, flag, flag, (ms, hideSeconds, hideYear) => {
		const r = p(ms, {colonNotation: true, hideSeconds, hideYear});
		assert.match(r, /^\d+(:\d+)+(\.\d+)?$/);
		const fields = r.split(':');
		for (const f of fields.slice(1)) assert.ok(f.split('.')[0].length >= 2, r);
	}));
});

test('colon notation total seconds round trip', () => {
	fc.assert(fc.property(fc.integer({min: 0, max: 2 ** 36}), ms => {
		const r = p(ms, {colonNotation: true, secondsDecimalDigits: 0, hideYear: true});
		const f = r.split(':').map(Number);
		let total = 0;
		const units = f.length === 2 ? [60, 1] : f.length === 3 ? [3600, 60, 1] : [86400, 3600, 60, 1];
		f.forEach((v, i) => { total += v * units[i]; });
		assert.equal(total, Math.floor(ms / 1000));
	}));
});

test('verbose matches short in numbers', () => {
	fc.assert(fc.property(intMs, o => {
		const a = p(o).replace(/[a-zµ]+/g, '');
		const b = p(o, {verbose: true}).replace(/ [a-z]+/g, '');
		assert.equal(a.replace(/ /g, ''), b.replace(/ /g, ''));
	}));
});

test('hideYearAndDays hours', () => {
	fc.assert(fc.property(intMs, ms => {
		const r = p(ms, {hideYearAndDays: true});
		const h = Math.floor(ms / 3600000);
		if (h) assert.ok(r.startsWith(h + 'h'), r);
	}));
});

test('monotone seconds: larger value never shows fewer whole seconds (default)', () => {
	fc.assert(fc.property(intMs, o => {
		const r = p(o, {secondsDecimalDigits: 0, hideYear: true});
		const m = /(\d+)d/.exec(r);
		assert.equal(m ? Number(m[1]) : 0, Math.floor(o / D));
	}));
});

test('formatSubMilliseconds fractional reconstruct', () => {
	fc.assert(fc.property(fc.integer({min: 0, max: 999}), fc.integer({min: 0, max: 999}), fc.integer({min: 0, max: 999}), (ms, us, ns) => {
		fc.pre(ms + us + ns > 0);
		const v = ms + (us / 1000) + (ns / 1e6);
		const r = p(v, {formatSubMilliseconds: true});
		const exp = [ms && ms + 'ms', us && us + 'µs', ns && ns + 'ns'].filter(Boolean).join(' ');
		assert.equal(r, exp);
	}));
});
