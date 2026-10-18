import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parseGoFailure, parseGoJson } from '../../../../src/lang/go.js';

const ev = (o) => JSON.stringify(o);
const word = fc.stringMatching(/^[a-z]{1,8}$/);

test('t.Error messages are reported as AssertionError with the message', () => {
  fc.assert(fc.property(word, (w) => {
    const r = parseGoFailure([`    x_test.go:3: ${w}\n`], new Map());
    assert.equal(r.type, 'AssertionError');
    assert.equal(r.message, w);
  }));
});

test('panic message parsed', () => {
  fc.assert(fc.property(word, (w) => {
    const r = parseGoFailure([`panic: ${w}\n`, '\n', 'goroutine 7 [running]:\n'], new Map());
    assert.equal(r.message, w);
    assert.equal(r.type, 'panic');
  }));
});

test('a test that failed on its own does not inherit another test\'s panic', () => {
  fc.assert(fc.property(word, word, (a, w) => {
    const stdout = [
      ev({ Action: 'run', Test: 'TestA' }),
      ev({ Action: 'output', Test: 'TestA', Output: `    a_test.go:3: ${a}\n` }),
      ev({ Action: 'fail', Test: 'TestA' }),
      ev({ Action: 'output', Output: `panic: ${w}\n` }),
      ev({ Action: 'output', Output: 'FAIL\n' }),
    ].join('\n');
    const { tests } = parseGoJson(stdout, new Map());
    assert.equal(tests[0].error.message, a);
  }));
});
