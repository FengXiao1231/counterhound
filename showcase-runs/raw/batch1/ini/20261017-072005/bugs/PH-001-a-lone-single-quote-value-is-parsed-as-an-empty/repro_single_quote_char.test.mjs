import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../../../../../lib/ini.js';

test('repro_single_quote_char', () => {
  assert.deepEqual({ ...mod.parse(mod.stringify({ a: "'" })) }, { a: "'" });
});
