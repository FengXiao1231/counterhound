import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtMs } from '../../../../../src/util.js';
test('repro_fmtms_rounding', () => {
  assert.notEqual(fmtMs(119500), '1m60s');
  assert.notEqual(fmtMs(59600), '60s');
});
