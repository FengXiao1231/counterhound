import test from 'node:test';
import assert from 'node:assert/strict';
import filenamify from '../../../../filenamify.js';

test('repro_replacement_not_nfc', () => {
	const out = filenamify('a/b', {replacement: 'é'});
	assert.equal(out, out.normalize('NFC'));
	assert.equal(filenamify(out, {replacement: 'é'}), out);
});
