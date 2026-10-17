import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'proofhound.js');
const hasHypothesis = spawnSync('python3', ['-c', 'import hypothesis, pytest']).status === 0;

test('end to end: only bugs that replay and survive review are reported', { skip: !hasHypothesis && 'needs python3 with pytest + hypothesis' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-e2e-'));
  fs.cpSync(path.join(ROOT, 'test', 'fixtures', 'pylib'), dir, { recursive: true });
  const r = spawnSync(process.execPath, [BIN, '--agent', 'fake', '--runs', '2', '--json', '-q'], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent.mjs') },
  });
  assert.equal(r.status, 1, r.stderr); // exit 1 = bugs found
  const result = JSON.parse(r.stdout);
  const by = Object.fromEntries(result.findings.map((f) => [f.title, f]));

  assert.equal(by['chunk() drops the final partial chunk'].status, 'confirmed');
  assert.equal(by['chunk() drops the final partial chunk'].verification.kind, 'assertion');
  assert.ok(by['chunk() drops the final partial chunk (dup)'].duplicateOf);
  assert.match(by['bogus: passes'].verification.reason ?? JSON.stringify(by['bogus: passes']), /repro passes/);
  assert.match(by['bogus: typo in test'].verification.reason, /test error/);
  assert.match(by['bogus: flaky'].verification.reason, /not deterministic/);
  assert.match(by['bogus: missing file'].verification.reason, /does not exist/);
  const div = by['safe_div raises on zero'];
  assert.equal(div.verification.kind, 'crash');
  assert.equal(div.verification.explicitRaise, true);
  assert.equal(div.status, 'rejected');

  assert.equal(result.counts.confirmed, 1);
  const bugDir = path.join(dir, by['chunk() drops the final partial chunk'].bugDir);
  assert.ok(fs.existsSync(path.join(bugDir, 'BUG.md')));
  assert.ok(fs.existsSync(path.join(bugDir, 'test_repro_chunk.py')));
  assert.ok(fs.existsSync(path.join(dir, '.proofhound', 'report.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});
