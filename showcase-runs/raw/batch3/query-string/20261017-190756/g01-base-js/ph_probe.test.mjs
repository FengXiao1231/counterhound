import test from 'node:test';
import assert from 'node:assert/strict';
import {parse, stringify} from '../../../../base.js';

for (const arrayFormat of ['bracket', 'index', 'colon-list-separator', 'none']) {
	test('probe ' + arrayFormat, () => {
		const s = stringify({0: ['a', '0']}, {arrayFormat});
		const p = {...parse(s, {arrayFormat, sort: false})};
		assert.deepEqual(p, {0: ['a', '0']}, s);
	});
}
