// A scripted stand-in for a coding agent, used by the end-to-end test.
import fs from 'node:fs';
import path from 'node:path';

const PROPS = `from hypothesis import given, strategies as st
from textkit.lists import chunk


@given(st.lists(st.integers()), st.integers(min_value=1, max_value=5))
def test_chunk_roundtrip(xs, n):
    assert [x for c in chunk(xs, n) for x in c] == xs
`;

const FILES = {
  'test_repro_chunk.py': 'from textkit.lists import chunk\n\n\ndef test_repro_chunk():\n    assert chunk([1, 2, 3], 2) == [[1, 2], [3]]\n',
  'test_repro_chunk_again.py': 'from textkit.lists import chunk\n\n\ndef test_repro_chunk_again():\n    assert chunk([1], 2) == [[1]]\n',
  'test_repro_wrong.py': 'from textkit.lists import chunk\n\n\ndef test_repro_wrong():\n    assert chunk([1, 2], 2) == [[1, 2]]\n',
  'test_repro_typo.py': 'from textkit.lists import chunk\n\n\ndef test_repro_typo():\n    assert chunkk([1], 1) == [[1]]\n',
  'test_repro_flaky.py': 'import random\nfrom textkit.lists import chunk\n\n\ndef test_repro_flaky():\n    assert random.random() < 0.5\n',
  'test_repro_div.py': 'from textkit.numbers import safe_div\n\n\ndef test_repro_div():\n    assert safe_div(1, 0) == 0\n',
};

const finding = (title, repro, extra = {}) => ({
  title, function: 'textkit.lists.chunk', kind: 'wrong-result', property: 'concatenating the chunks gives back the input',
  property_test: 'test_chunk_roundtrip', repro_file: repro, input: 'chunk([1, 2, 3], 2)', expected: '[[1, 2], [3]]',
  actual: '[[1, 2]]', evidence: 'Docstring: the last chunk may be shorter.', ...extra,
});

export default async function fakeAgent({ prompt, cwd }) {
  if (prompt.includes("proofhound's bug hunter")) {
    const rel = prompt.match(/Create files only inside `([^`]+)\/`/)[1];
    const dir = path.join(cwd, rel);
    if (!prompt.includes('textkit/lists.py')) {
      fs.writeFileSync(path.join(dir, 'findings.json'), '[]');
      return 'tested 0 properties, reported 0 bugs';
    }
    fs.writeFileSync(path.join(dir, 'test_ph_props.py'), PROPS);
    for (const [name, src] of Object.entries(FILES)) fs.writeFileSync(path.join(dir, name), src);
    const findings = [
      finding('chunk() drops the final partial chunk', 'test_repro_chunk.py'),
      finding('chunk() drops the final partial chunk (dup)', 'test_repro_chunk_again.py'),
      finding('bogus: passes', 'test_repro_wrong.py'),
      finding('bogus: typo in test', 'test_repro_typo.py'),
      finding('bogus: flaky', 'test_repro_flaky.py'),
      finding('safe_div raises on zero', 'test_repro_div.py', { function: 'textkit.numbers.safe_div', kind: 'crash', property: 'never raises' }),
      finding('bogus: missing file', 'test_repro_nope.py'),
    ];
    fs.writeFileSync(path.join(dir, 'findings.json'), 'Here you go:\n```json\n' + JSON.stringify(findings) + '\n```');
    return 'tested 1 property, reported 7 bugs';
  }
  if (prompt.includes('You are fixing a confirmed bug')) {
    // cwd is the sandbox copy of the project
    const file = path.join(cwd, 'textkit', 'lists.py');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('range(0, len(xs) - size + 1, size)', 'range(0, len(xs), size)'));
    // a log file in the real project that keeps growing while the fix runs must not end up in the patch
    if (process.env.PROOFHOUND_FAKE_TOUCH) fs.appendFileSync(process.env.PROOFHOUND_FAKE_TOUCH, 'still running\n');
    return 'Iterate up to len(xs) so the last partial chunk is kept.';
  }
  if (prompt.includes('skeptical, experienced maintainer')) {
    if (prompt.includes('safe_div')) return '{"verdict":"not_a_bug","confidence":0.9,"severity":"low","category":"crash","title":"x","reason":"Documented ValueError.","maintainer_would_fix":false}';
    return '{"verdict":"bug","confidence":0.93,"severity":"medium","category":"wrong-result","title":"chunk() drops the last partial chunk","reason":"The docstring says the last chunk may be shorter.","maintainer_would_fix":true}';
  }
  throw new Error('unexpected prompt');
}
