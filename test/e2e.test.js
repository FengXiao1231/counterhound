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

  // the stateful class: a plain step sequence, and a repro built from the project's own fixture
  const removeQty = by['Cart.remove ignores qty and drops the whole line'];
  assert.equal(removeQty.status, 'confirmed', JSON.stringify(removeQty.verification));
  const negative = by['Cart.total goes negative after a discount when lines are removed'];
  assert.equal(negative.status, 'confirmed', JSON.stringify(negative.verification));
  assert.equal(negative.verification.kind, 'assertion');
  const missing = by['Cart.remove raises KeyError for an unknown sku'];
  assert.equal(missing.verification.explicitRaise, true);
  assert.equal(missing.status, 'rejected');
  const cartPrompt = fs.readFileSync(path.join(dir, removeQty.workdir, 'prompt.md'), 'utf8');
  assert.match(cartPrompt, /Stateful classes[\s\S]*`Cart\(self\) -> None`[\s\S]*changes state: `add\(/);
  assert.match(cartPrompt, /fixture `cart` -> Cart \(tests\/conftest\.py\): A cart holding two/);
  assert.ok(result.groups[0].file === 'textkit/cart.py', 'the stateful class is hunted first: ' + result.groups.map((g) => g.file).join(', '));

  assert.equal(result.counts.confirmed, 3);
  const bugDir = path.join(dir, by['chunk() drops the final partial chunk'].bugDir);
  assert.ok(fs.existsSync(path.join(bugDir, 'BUG.md')));
  assert.ok(fs.existsSync(path.join(bugDir, 'test_repro_chunk.py')));
  assert.ok(fs.existsSync(path.join(dir, '.proofhound', 'report.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

const hasFastapi = spawnSync('python3', ['-c', 'import hypothesis, pytest, fastapi, httpx']).status === 0;

test('--api: routes of a FastAPI app are hunted through its test client; handler crashes are attributed', { skip: !hasFastapi && 'needs python3 with pytest, hypothesis, fastapi and httpx' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-e2e-api-'));
  fs.cpSync(path.join(ROOT, 'test', 'fixtures', 'pyapi'), dir, { recursive: true, filter: (s) => !s.includes('.proofhound') && !s.includes('__pycache__') });
  const r = spawnSync(process.execPath, [BIN, '--api', '--agent', 'fake', '--runs', '2', '--json', '-q'], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent.mjs') },
  });
  assert.equal(r.status, 1, r.stderr);
  const result = JSON.parse(r.stdout);
  const by = Object.fromEntries(result.findings.map((f) => [f.title, f]));
  assert.deepEqual(result.api, { framework: 'fastapi', app: 'app.main:app' });
  assert.deepEqual(result.groups.map((g) => g.functions), [['POST /items', 'PUT /items/{item_id}', 'GET /items', 'GET /items/{item_id}', 'DELETE /items/{item_id}']]);
  const crash = by['GET /items/{id} crashes for an unknown id instead of 404'];
  assert.equal(crash.status, 'confirmed', JSON.stringify(crash.verification));
  assert.equal(crash.verification.kind, 'crash');
  assert.equal(crash.verification.site.file, 'app/main.py');
  assert.equal(crash.verification.error.type, 'KeyError');
  assert.equal(by['PUT is not idempotent: the version changes on a no-op update'].status, 'confirmed');
  assert.equal(by['GET /items paging drops the last item of every page'].status, 'confirmed');
  const decoy = by['POST /items rejects a negative price'];
  assert.equal(decoy.verification.kind, 'assertion');
  assert.equal(decoy.status, 'rejected');
  assert.equal(result.counts.confirmed, 3);
  const openapi = JSON.parse(fs.readFileSync(path.join(dir, '.proofhound', 'openapi.json'), 'utf8'));
  assert.ok(openapi.paths['/items/{item_id}'].put, 'openapi.json is written for the hunter');
  assert.ok(fs.existsSync(path.join(dir, crash.bugDir, 'BUG.md')));
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

test('end to end on JavaScript, with --fix: errors are attributed, patches that touch existing tests are rejected', { timeout: 600000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-e2e-jslib-'));
  fs.cpSync(path.join(ROOT, 'test', 'fixtures', 'jslib'), dir, { recursive: true, filter: (s) => !s.includes('.proofhound') });
  const r = spawnSync(process.execPath, [BIN, '--agent', 'fake', '--runs', '2', '--fix', '--json', '-q'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent-compiled.mjs') },
  });
  assert.equal(r.status, 1, r.stderr);
  const result = JSON.parse(r.stdout);
  const by = Object.fromEntries(result.findings.map((f) => [f.title, f]));
  assert.equal(result.lang, 'javascript');
  assert.equal(by['uniqueBy keeps the last duplicate'].status, 'confirmed');
  assert.equal(by['uniqueBy keeps the last duplicate'].verification.kind, 'assertion');
  assert.equal(by['truncate exceeds max'].status, 'confirmed');
  const range = by['rangeInclusive throws on step 0'];
  assert.equal(range.verification.kind, 'crash');
  assert.equal(range.verification.site.file, 'src/arrays.js');
  assert.equal(range.verification.explicitRaise, true);
  assert.equal(range.status, 'rejected');
  assert.match(by['bogus: test bug'].verification.reason, /test error/);
  assert.match(by['bogus: build'].verification.reason, /could not be collected|loaded|test error/);
  assert.match(by['bogus: random'].verification.reason, /not deterministic/);
  assert.match(by['bogus: passes'].verification.reason, /repro passes/);
  // the stateful class is hunted first, as a whole; one repro is built from the project's own test helper
  assert.equal(result.groups[0].file, 'src/cart.js', result.groups.map((g) => g.file).join(', '));
  assert.equal(by['Cart.remove ignores qty and drops the whole line'].status, 'confirmed');
  assert.equal(by['Cart.total goes negative after a discount when lines are removed'].status, 'confirmed');
  const missing = by['Cart.remove throws on an unknown sku'];
  assert.equal(missing.verification.kind, 'crash');
  assert.equal(missing.verification.explicitRaise, true);
  assert.equal(missing.status, 'rejected');
  assert.match(fs.readFileSync(path.join(dir, missing.workdir, 'prompt.md'), 'utf8'), /Stateful classes[\s\S]*`Cart\(\)`[\s\S]*changes state: `add\(sku, price, qty = 1\)`/);
  assert.equal(result.counts.confirmed, 4);
  // --fix: the truncate patch is kept (the repro, re-imported from the sandbox, passes; npm test still green);
  // the uniqueBy patch also rewrote an existing test file, so it is rejected
  const tr = by['truncate exceeds max'].fix, un = by['uniqueBy keeps the last duplicate'].fix;
  assert.equal(tr.status, 'verified', JSON.stringify(tr));
  assert.deepEqual(tr.files, ['src/text.js']);
  assert.match(tr.suite, /^passed/);
  assert.equal(un.status, 'rejected', JSON.stringify(un));
  assert.match(un.reason, /project's own tests/);
  assert.equal(result.counts.fixed, 1);
  assert.ok(fs.existsSync(path.join(dir, by['truncate exceeds max'].bugDir, 'fix.patch')));
  assert.ok(!fs.readFileSync(path.join(dir, 'src', 'text.js'), 'utf8').includes('max - 1'), 'project must not change');
  // everything proofhound generated is ignored by git, so `git add -A` picks up nothing
  const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  assert.equal(git('status', '--porcelain', '--untracked-files=all').stdout.split('\n').filter((l) => l.includes('.proofhound')).join('\n'), '');
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
  fs.writeFileSync(path.join(dir, 'run.log'), 'started\n');
  const r = spawnSync(process.execPath, [BIN, '--agent', 'fake', '--runs', '1', '--fix', '--json', '-q'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PROOFHOUND_FAKE_AGENT: path.join(ROOT, 'test', 'helpers', 'fake-agent.mjs'), PROOFHOUND_FAKE_TOUCH: path.join(dir, 'run.log') },
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
