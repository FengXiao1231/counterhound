import test from 'node:test';
import p from '../../../../index.js';

test('probe', () => {
	const c = [[0, {}], [1, {subSecondsAsDecimals: true}], [50, {subSecondsAsDecimals: true, verbose: true}], [1000, {verbose: true, keepDecimalsOnWholeSeconds: true}], [1500, {verbose: true}], [1000, {colonNotation: true, subSecondsAsDecimals: true}], [500, {colonNotation: true}], [0, {colonNotation: true}], [0, {colonNotation: true, hideSeconds: true}], [3600000, {hideYearAndDays: true, colonNotation: true}], [59999, {compact: true}], [0.5, {verbose: true}], [1, {verbose: true, millisecondsDecimalDigits: 1}], [61000, {hideSeconds: true, verbose: true}], [1e-9, {formatSubMilliseconds: true}], [1.5, {formatSubMilliseconds: true, verbose: true}], [-0.4, {}], [1000.5, {separateMilliseconds: true}], [999.6, {separateMilliseconds: true}], [60000, {unitCount: 1, verbose: true}], [3600000, {hideSeconds: true, colonNotation: true}], [86400000 * 400, {colonNotation: true}], [1010, {secondsDecimalDigits: 2, verbose: true}], [1, {verbose: true, millisecondsDecimalDigits: 2}], [1.001, {verbose: true, millisecondsDecimalDigits: 2}], [1000, {verbose: true, secondsDecimalDigits: 1, keepDecimalsOnWholeSeconds: true}], [2, {verbose: true, millisecondsDecimalDigits: 1}], [1000, {formatSubMilliseconds: true, verbose: true}], [59000, {colonNotation: true, hideSeconds: true}]];
	const out = c.map(([m, o]) => `${m} ${JSON.stringify(o)} => ${p(m, o)}`);
	throw new Error(out.join(' | '));
});
