import test from 'node:test';
import assert from 'node:assert/strict';
import { relPath } from '../../../../src/util.js';
test('repro_relpath_dotdot_name', () => {
  assert.equal(relPath('/root', '/root/..foo/a.js'), '..foo/a.js');
});
