import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../../../../lib/ini.js';

test('repro_backslash_semicolon', () => {
  assert.deepEqual({ ...mod.parse(mod.stringify({ a: '\\;' })) }, { a: '\\;' });
});
