import test from 'node:test';
import assert from 'node:assert/strict';
import {stringifyUrl} from '../../../../../base.js';

test('repro_index_nosort: stringifyUrl keeps existing index-format array in url', () => {
	assert.equal(
		stringifyUrl({url: 'https://foo.bar?a[0]=x&a[1]=y', query: {}}, {arrayFormat: 'index', encode: false}),
		'https://foo.bar?a[0]=x&a[1]=y',
	);
});
