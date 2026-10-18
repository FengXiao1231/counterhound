import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../../../../punycode.js';

test('repro_multi_at', () => {
  assert.equal(mod.toASCII('a@b@c'), 'a@b@c');
});
