import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLibtest } from '../../../../../../src/lang/rust.js';

test('repro_should_panic', () => {
  const out = `running 1 test
test tests::it_panics - should panic ... FAILED

failures:

---- tests::it_panics stdout ----
note: test did not panic as expected

failures:
    tests::it_panics

test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out
`;
  const got = parseLibtest(out, undefined);
  assert.equal(got.length, 1);
  assert.equal(got[0].outcome, 'failed');
});
