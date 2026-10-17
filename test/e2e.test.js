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

const hasGo = spawnSync('go', ['version']).status === 0;
const hasCargo = spawnSync('cargo', ['--version']).status === 0;

function runFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ph-e2e-${name}-`));
  fs.cpSync(path.join(ROOT, 'test', 'fixtures', name), dir, { recursive: true, filter: (s) => !s.includes('.proofhound') });
  const r = spawnSync(process.execPath, [BIN, '--agent', 'fake', '--runs', '2', '--json', '-q'], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent-compiled.mjs') },
  });
  assert.equal(r.status, 1, r.stderr);
  const result = JSON.parse(r.stdout);
  return { dir, result, by: Object.fromEntries(result.findings.map((f) => [f.title, f])) };
}

test('end to end on Go: panics are attributed, test bugs and build errors dropped', { skip: !hasGo && 'needs go' }, () => {
  const { dir, result, by } = runFixture('golib');
  assert.equal(result.lang, 'go');
  assert.equal(by['Range.Contains includes Hi'].status, 'confirmed');
  assert.equal(by['Range.Contains includes Hi'].verification.kind, 'assertion');
  const median = by['Median panics on empty input'];
  assert.equal(median.status, 'confirmed');
  assert.equal(median.verification.kind, 'crash');
  assert.equal(median.verification.site.file, 'textkit/textkit.go');
  assert.equal(by['MustPositive panics'].verification.explicitRaise, true);
  assert.equal(by['MustPositive panics'].status, 'rejected');
  assert.match(by['bogus: test bug'].verification.reason, /test error/);
  assert.match(by['bogus: build'].verification.reason, /could not be collected|loaded/);
  assert.match(by['bogus: rand'].verification.reason, /not deterministic/);
  assert.match(by['bogus: passes'].verification.reason, /repro passes/);
  assert.equal(result.counts.confirmed, 2);
  assert.equal(fs.readFileSync(path.join(dir, 'go.mod'), 'utf8'), fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'golib', 'go.mod'), 'utf8'), 'go.mod must not change');
  assert.ok(!fs.existsSync(path.join(dir, 'textkit', 'testdata')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('end to end on Rust: panics are attributed, documented errors rejected', { skip: !hasCargo && 'needs cargo', timeout: 600000 }, () => {
  const { dir, result, by } = runFixture('rustlib');
  assert.equal(result.lang, 'rust');
  assert.equal(by['median ignores the even case'].status, 'confirmed');
  assert.equal(by['median ignores the even case'].verification.kind, 'assertion');
  const tr = by['truncate panics inside a character'];
  assert.equal(tr.status, 'confirmed');
  assert.equal(tr.verification.kind, 'crash');
  assert.equal(tr.verification.site.file, 'src/lib.rs');
  assert.equal(by['chunk panics on zero'].verification.explicitRaise, true);
  assert.equal(by['parse_percent rejects 101'].status, 'rejected');
  assert.match(by['bogus: build'].verification.reason, /could not be collected|loaded/);
  assert.equal(result.counts.confirmed, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('diff mode: only functions changed since the base are hunted', { skip: !hasHypothesis && 'needs python3 with pytest + hypothesis' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-e2e-diff-'));
  fs.cpSync(path.join(ROOT, 'test', 'fixtures', 'pylib'), dir, { recursive: true });
  const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main'); git('add', '.'); git('commit', '-qm', 'base'); git('checkout', '-qb', 'pr');
  const file = path.join(dir, 'textkit', 'lists.py');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('raise ValueError("size must be positive")', 'raise ValueError("chunk size must be positive")'));
  const summary = path.join(dir, 'summary.md');
  const r = spawnSync(process.execPath, [BIN, '--agent', 'fake', '--runs', '1', '--diff', 'main', '--summary-file', summary, '--json', '-q'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent.mjs') },
  });
  const result = JSON.parse(r.stdout);
  assert.equal(result.diff.base, 'main');
  assert.deepEqual(result.groups.map((g) => g.file), ['textkit/lists.py']);
  assert.deepEqual(result.groups[0].functions, ['chunk']);
  assert.match(fs.readFileSync(summary, 'utf8'), /found 1 provable bug/);

  // nothing testable changed: a clean, successful run
  git('add', '.'); git('commit', '-qm', 'pr');
  const r2 = spawnSync(process.execPath, [BIN, '--agent', 'fake', '--diff', 'HEAD', '--summary-file', summary, '-q'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent.mjs') },
  });
  assert.equal(r2.status, 0, r2.stderr);
  assert.match(fs.readFileSync(summary, 'utf8'), /nothing to check/);
  fs.rmSync(dir, { recursive: true, force: true });
});

const hasJava = spawnSync('javac', ['-version']).status === 0;

test('end to end on Java: exceptions are attributed, documented throws rejected', { skip: !hasJava && 'needs a JDK', timeout: 600000 }, () => {
  const { dir, result, by } = runFixture('javalib');
  assert.equal(result.lang, 'java');
  assert.equal(by['Range.contains includes hi'].status, 'confirmed');
  assert.equal(by['Range.contains includes hi'].verification.kind, 'assertion');
  const median = by['median throws on empty input'];
  assert.equal(median.status, 'confirmed');
  assert.equal(median.verification.kind, 'crash');
  assert.equal(median.verification.site.file, 'src/main/java/com/example/textkit/TextKit.java');
  assert.equal(by['parsePercent rejects 101'].verification.explicitRaise, true);
  assert.equal(by['parsePercent rejects 101'].status, 'rejected');
  assert.match(by['bogus: test bug'].verification.reason, /test error/);
  assert.match(by['bogus: build'].verification.reason, /could not be collected|loaded/);
  assert.match(by['bogus: random'].verification.reason, /not deterministic/);
  assert.match(by['bogus: passes'].verification.reason, /repro passes/);
  assert.equal(result.counts.confirmed, 2);
  assert.ok(!fs.existsSync(path.join(dir, 'target')), 'must not build into target/');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--fix: a patch is kept only if the repro passes in a sandbox; the project is untouched', { skip: !hasHypothesis && 'needs python3 with pytest + hypothesis' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-e2e-fix-'));
  fs.cpSync(path.join(ROOT, 'test', 'fixtures', 'pylib'), dir, { recursive: true });
  const before = fs.readFileSync(path.join(dir, 'textkit', 'lists.py'), 'utf8');
  const r = spawnSync(process.execPath, [BIN, '--agent', 'fake', '--runs', '1', '--fix', '--json', '-q'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent.mjs') },
  });
  const result = JSON.parse(r.stdout);
  const bug = result.findings.find((f) => f.status === 'confirmed');
  assert.equal(bug.fix.status, 'verified', JSON.stringify(bug.fix));
  assert.deepEqual(bug.fix.files, ['textkit/lists.py']);
  assert.match(bug.fix.patch, /^--- a\/textkit\/lists\.py$/m);
  assert.match(bug.fix.patch, /^\+.*range\(0, len\(xs\), size\)/m);
  assert.equal(result.counts.fixed, 1);
  assert.equal(fs.readFileSync(path.join(dir, 'textkit', 'lists.py'), 'utf8'), before, 'project must not change');
  assert.ok(fs.existsSync(path.join(dir, bug.bugDir, 'fix.patch')));
  // the patch applies cleanly to the project
  const apply = spawnSync('git', ['apply', '--check', path.join(dir, bug.bugDir, 'fix.patch')], { cwd: dir, encoding: 'utf8' });
  assert.equal(apply.status, 0, apply.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
});
