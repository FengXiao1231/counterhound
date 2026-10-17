// A scripted stand-in for a coding agent on the Go and Rust fixtures, used by the end-to-end tests.
import fs from 'node:fs';
import path from 'node:path';

const GO = {
  'repro_contains_test.go': 'package textkit\n\nimport "testing"\n\nfunc TestReproContains(t *testing.T) {\n\tif (Range{0, 3}).Contains(3) {\n\t\tt.Fatalf("Range{0, 3}.Contains(3) = true, want false")\n\t}\n}\n',
  'repro_median_test.go': 'package textkit\n\nimport "testing"\n\nfunc TestReproMedian(t *testing.T) {\n\tif got := Median(nil); got != 0 {\n\t\tt.Fatalf("got %v", got)\n\t}\n}\n',
  'repro_must_test.go': 'package textkit\n\nimport "testing"\n\nfunc TestReproMust(t *testing.T) {\n\t_ = MustPositive(-1)\n}\n',
  'repro_testbug_test.go': 'package textkit\n\nimport "testing"\n\nfunc TestReproTestBug(t *testing.T) {\n\tout := Chunk([]int{1, 2}, 2)\n\t_ = out[3]\n}\n',
  'repro_build_test.go': 'package textkit\n\nimport "testing"\n\nfunc TestReproBuild(t *testing.T) {\n\t_ = Nope(1)\n}\n',
  'repro_rand_test.go': 'package textkit\n\nimport (\n\t"math/rand"\n\t"testing"\n)\n\nfunc TestReproRand(t *testing.T) {\n\tif rand.Intn(2) == 0 {\n\t\tt.Fatal("x")\n\t}\n}\n',
  'repro_passes_test.go': 'package textkit\n\nimport "testing"\n\nfunc TestReproPasses(t *testing.T) {\n\tif Reverse("ab") != "ba" {\n\t\tt.Fatal("x")\n\t}\n}\n',
};

const RUST = {
  'repro_median.rs': '#[test]\nfn repro_median() {\n    assert_eq!(textkit::stats::median(&[1.0, 2.0]), Some(1.5));\n}\n',
  'repro_truncate.rs': '#[test]\nfn repro_truncate() {\n    assert_eq!(textkit::truncate("é", 1), "");\n}\n',
  'repro_percent.rs': '#[test]\nfn repro_percent() {\n    textkit::parse_percent("101").unwrap();\n}\n',
  'repro_chunk_zero.rs': '#[test]\nfn repro_chunk_zero() {\n    let _ = textkit::chunk(&[1], 0);\n}\n',
  'repro_build.rs': '#[test]\nfn repro_build() {\n    textkit::nope();\n}\n',
};

const J = (cls, body, imports = '') => `package com.example.textkit;\n\n${imports}import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\n\nclass ${cls} {\n    @Test\n    void repro() {\n        ${body}\n    }\n}\n`;
const JAVA = {
  'ReproContainsTest.java': J('ReproContainsTest', 'assertFalse(new Range(0, 3).contains(3));'),
  'ReproMedianTest.java': J('ReproMedianTest', 'assertEquals(0.0, TextKit.median(new double[0]));'),
  'ReproPercentTest.java': J('ReproPercentTest', 'assertEquals(101, TextKit.parsePercent("101"));'),
  'ReproTestBugTest.java': J('ReproTestBugTest', 'int[] a = new int[1]; a[2] = TextKit.midpoint(1, 2);'),
  'ReproBuildTest.java': J('ReproBuildTest', 'TextKit.nope();'),
  'ReproRandomTest.java': J('ReproRandomTest', 'assertTrue(new Random().nextBoolean());', 'import java.util.Random;\n'),
  'ReproPassesTest.java': J('ReproPassesTest', 'assertEquals("ba", TextKit.reverse("ab"));'),
};

const f = (title, fn, repro, kind = 'wrong-result') => ({
  title, function: fn, kind, property: title, property_test: '', repro_file: repro,
  input: 'see repro', expected: 'see repro', actual: 'see repro', evidence: 'doc comment',
});

export default async function fakeAgent({ prompt, cwd }) {
  if (prompt.includes("proofhound's bug hunter")) {
    const dir = path.join(cwd, prompt.match(/Create files only inside `([^`]+)\/`/)[1]);
    const isGo = prompt.includes('Go + rapid');
    const isJava = prompt.includes('Java + JUnit 5');
    const files = isJava ? JAVA : isGo ? GO : RUST;
    for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), src);
    const findings = isJava ? [
      f('Range.contains includes hi', 'com.example.textkit.Range.contains', 'ReproContainsTest.java'),
      f('median throws on empty input', 'com.example.textkit.TextKit.median', 'ReproMedianTest.java', 'crash'),
      f('parsePercent rejects 101', 'com.example.textkit.TextKit.parsePercent', 'ReproPercentTest.java', 'crash'),
      f('bogus: test bug', 'com.example.textkit.TextKit.midpoint', 'ReproTestBugTest.java', 'crash'),
      f('bogus: build', 'com.example.textkit.TextKit.chunk', 'ReproBuildTest.java'),
      f('bogus: random', 'com.example.textkit.TextKit.chunk', 'ReproRandomTest.java'),
      f('bogus: passes', 'com.example.textkit.TextKit.reverse', 'ReproPassesTest.java'),
    ] : isGo ? [
      f('Range.Contains includes Hi', 'Range.Contains', 'repro_contains_test.go'),
      f('Median panics on empty input', 'Median', 'repro_median_test.go', 'crash'),
      f('MustPositive panics', 'MustPositive', 'repro_must_test.go', 'crash'),
      f('bogus: test bug', 'Chunk', 'repro_testbug_test.go', 'crash'),
      f('bogus: build', 'Chunk', 'repro_build_test.go'),
      f('bogus: rand', 'Chunk', 'repro_rand_test.go'),
      f('bogus: passes', 'Reverse', 'repro_passes_test.go'),
    ] : [
      f('median ignores the even case', 'textkit::stats::median', 'repro_median.rs'),
      f('truncate panics inside a character', 'textkit::truncate', 'repro_truncate.rs', 'crash'),
      f('parse_percent rejects 101', 'textkit::parse_percent', 'repro_percent.rs'),
      f('chunk panics on zero', 'textkit::chunk', 'repro_chunk_zero.rs', 'crash'),
      f('bogus: build', 'textkit::chunk', 'repro_build.rs'),
    ];
    // the Rust fixture has two modules; report each finding in the module it belongs to
    const inStats = prompt.includes('File: src/stats.rs');
    const inRange = prompt.includes('File: src/main/java/com/example/textkit/Range.java');
    const mine = isJava ? findings.filter((x) => x.function.includes('.Range.') === inRange)
      : isGo ? findings : findings.filter((x) => x.function.includes('::stats::') === inStats);
    fs.writeFileSync(path.join(dir, 'findings.json'), JSON.stringify(mine));
    return `reported ${findings.length} bugs`;
  }
  if (prompt.includes('skeptical, experienced maintainer')) {
    if (/MustPositive|parse_percent|parsePercent|chunk panics on zero/.test(prompt)) return '{"verdict":"not_a_bug","confidence":0.9,"severity":"low","category":"crash","title":"x","reason":"Documented.","maintainer_would_fix":false}';
    return '{"verdict":"bug","confidence":0.9,"severity":"medium","category":"wrong-result","title":"confirmed","reason":"Contradicts the doc comment.","maintainer_would_fix":true}';
  }
  throw new Error('unexpected prompt');
}
