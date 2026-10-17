// node:test reporter used by proofhound: writes structured results to $PROOFHOUND_REPORT.
import { writeFileSync } from 'node:fs';

function describe(err, depth = 0) {
  if (!err || typeof err !== 'object') return { type: typeof err, message: String(err), stack: '' };
  // node:test wraps thrown values in ERR_TEST_FAILURE with the original as `cause`.
  if (err.code === 'ERR_TEST_FAILURE' && err.cause && depth === 0) return describe(err.cause, depth);
  const out = {
    type: err.name || err.constructor?.name || 'Error',
    code: err.code,
    message: String(err.message ?? '').slice(0, 4000),
    stack: String(err.stack ?? '').slice(0, 8000),
  };
  if (err.cause && depth < 2) out.cause = describe(err.cause, depth + 1);
  if ('actual' in err || 'expected' in err) {
    try { out.actual = JSON.stringify(err.actual)?.slice(0, 1000); } catch { /* circular */ }
    try { out.expected = JSON.stringify(err.expected)?.slice(0, 1000); } catch { /* circular */ }
  }
  return out;
}

export default async function* reporter(source) {
  const tests = [];
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data;
    if (d.details?.type === 'suite') continue;
    const entry = { name: d.name, file: d.file, nesting: d.nesting, outcome: event.type === 'test:pass' ? (d.skip ? 'skipped' : 'passed') : 'failed', duration: d.details?.duration_ms };
    if (event.type === 'test:fail') entry.error = describe(d.details?.error);
    tests.push(entry);
  }
  if (process.env.PROOFHOUND_REPORT) writeFileSync(process.env.PROOFHOUND_REPORT, JSON.stringify({ tests }));
  yield '';
}
