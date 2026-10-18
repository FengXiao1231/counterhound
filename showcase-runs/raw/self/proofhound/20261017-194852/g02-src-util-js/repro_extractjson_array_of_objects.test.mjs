import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJSON } from '../../../../src/util.js';
test('repro_extractjson_array_of_objects', () => {
  assert.deepEqual(extractJSON('Result: [{"a":1},{"b":2}]'), [{ a: 1 }, { b: 2 }]);
});
