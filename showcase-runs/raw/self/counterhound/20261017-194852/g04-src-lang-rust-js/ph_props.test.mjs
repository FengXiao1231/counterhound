import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRustFailure, parseLibtest, crateInfo } from '../../../../src/lang/rust.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ident = fc.stringMatching(/^[a-z][a-z0-9_]{0,6}$/);
const testName = fc.array(ident, { minLength: 1, maxLength: 3 }).map((a) => a.join('::'));
const msgLine = fc.stringMatching(/^[A-Za-z0-9 =`<>!(),.]{1,20}$/).filter((s) => s.trim() && !/^\s*(note: |stack backtrace:|thread ')/.test(s));

test('parseRustFailure recovers panic message', () => {
  fc.assert(fc.property(fc.array(msgLine, { minLength: 1, maxLength: 3 }), fc.nat(500), (lines, ln) => {
    const msg = lines.join('\n');
    const sec = `thread 'a::b' panicked at src/lib.rs:${ln}:5:\n${msg}\nnote: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace\n`;
    const r = parseRustFailure(sec, undefined);
    assert.equal(r.message, msg.trim());
  }));
});

test('parseLibtest reports every test line with outcome', () => {
  const entry = fc.record({ name: testName, kind: fc.constantFrom('ok', 'FAILED', 'ignored', 'should-ok', 'should-failed') });
  fc.assert(fc.property(fc.uniqueArray(entry, { selector: (e) => e.name, minLength: 1, maxLength: 5 }), (es) => {
    let out = `running ${es.length} tests\n`;
    for (const e of es) {
      const suffix = e.kind.startsWith('should') ? ' - should panic' : '';
      const res = e.kind.endsWith('ok') || e.kind === 'ok' ? 'ok' : e.kind === 'ignored' ? 'ignored' : 'FAILED';
      out += `test ${e.name}${suffix} ... ${res}\n`;
    }
    const failed = es.filter((e) => e.kind === 'FAILED' || e.kind === 'should-failed');
    if (failed.length) {
      out += '\nfailures:\n';
      for (const e of failed) out += `\n---- ${e.name} stdout ----\nthread '${e.name}' panicked at src/lib.rs:1:1:\nboom\n`;
      out += '\nfailures:\n' + failed.map((e) => `    ${e.name}`).join('\n') + '\n';
    }
    const got = parseLibtest(out, undefined);
    assert.equal(got.length, es.length);
  }));
});

test('crateInfo with trailing comment on header', () => {
  const d = fs.mkdtempSync(path.join(here, 'c-'));
  fs.mkdirSync(path.join(d, 'src'));
  fs.writeFileSync(path.join(d, 'src/lib.rs'), '');
  fs.writeFileSync(path.join(d, 'Cargo.toml'), '[package] # my crate\nname = "x-y"\nedition = "2021"\n');
  const r = crateInfo(d);
  assert.equal(r && r.libName, 'x_y');
});
