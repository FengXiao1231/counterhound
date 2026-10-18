import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoJson } from '../../../../src/lang/go.js';

test('repro_sibling_panic', () => {
  const stdout = [
    { Action: 'run', Test: 'TestA' },
    { Action: 'output', Test: 'TestA', Output: '    a_test.go:3: got 1, want 2\n' },
    { Action: 'fail', Test: 'TestA' },
    { Action: 'run', Test: 'TestB' },
    { Action: 'output', Output: 'panic: boom\n' },
    { Action: 'output', Output: 'FAIL\n' },
  ].map((e) => JSON.stringify(e)).join('\n');
  const { tests } = parseGoJson(stdout, new Map());
  const a = tests.find((t) => t.name === 'TestA');
  assert.equal(a.error.type, 'AssertionError');
  assert.equal(a.error.message, 'got 1, want 2');
});
