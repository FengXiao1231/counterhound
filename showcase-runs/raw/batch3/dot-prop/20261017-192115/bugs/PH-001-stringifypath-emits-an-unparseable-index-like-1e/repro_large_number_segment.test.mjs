import test from 'node:test';
import assert from 'node:assert/strict';
import {stringifyPath, parsePath} from '../../../../../index.js';

test('repro_large_number_segment', () => {
	// stringifyPath output must be a valid path string that parsePath accepts.
	const path = stringifyPath([1e21]);
	assert.doesNotThrow(() => parsePath(path), `stringifyPath([1e21]) gave unparseable ${JSON.stringify(path)}`);
});
