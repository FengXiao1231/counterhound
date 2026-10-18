import test from 'node:test';
import assert from 'node:assert/strict';
import { pascalSnakeCase } from '../../../../packages/change-case/src/index.ts';

test('repro_astral_capitalize', () => {
  // U+10428 DESERET SMALL LETTER LONG I; its uppercase is U+10400
  assert.equal(pascalSnakeCase('\u{10428}a', { locale: false }), '\u{10400}a');
});
