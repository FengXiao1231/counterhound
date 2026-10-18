import test from 'node:test';
import assert from 'node:assert/strict';
import parse from '../../../../../lib/parse.js';

test('repro_comma_numeric_entities', () => {
  assert.deepEqual(
    parse('a=b,c', { comma: true, charset: 'iso-8859-1', interpretNumericEntities: true }),
    { a: ['b', 'c'] }
  );
});
