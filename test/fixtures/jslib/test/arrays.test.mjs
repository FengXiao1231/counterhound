import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from '../src/arrays.js';
test('page', () => { assert.deepEqual(page([1, 2, 3], 2, 2), [3]); });
