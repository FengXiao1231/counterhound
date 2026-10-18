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

// JS repros import the fixture's sources by a path relative to the work dir, as the hunter is told to.
const JS = (toSrc) => ({
  'repro_unique.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { uniqueBy } from '${toSrc}/arrays.js';\ntest('repro_unique', () => { assert.deepEqual(uniqueBy([{ k: 1, v: 'a' }, { k: 1, v: 'b' }], (x) => x.k), [{ k: 1, v: 'a' }]); });\n`,
  'repro_truncate.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { truncate } from '${toSrc}/text.js';\ntest('repro_truncate', () => { assert.ok(truncate('abcdef', 3).length <= 3); });\n`,
  'repro_range.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { rangeInclusive } from '${toSrc}/arrays.js';\ntest('repro_range', () => { assert.deepEqual(rangeInclusive(1, 3, 0), []); });\n`,
  'repro_testbug.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { page } from '${toSrc}/arrays.js';\ntest('repro_testbug', () => { assert.deepEqual(pagee([1, 2], 1, 1), [1]); });\n`,
  'repro_build.test.mjs': `import test from 'node:test';\nimport { nope } from '${toSrc}/arrays.js';\ntest('repro_build', () => { nope(); });\n`,
  'repro_random.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('repro_random', () => { assert.ok(Math.random() < 0.5); });\n`,
  'repro_passes.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { camelToSnake } from '${toSrc}/text.js';\ntest('repro_passes', () => { assert.equal(camelToSnake('aB'), 'a_b'); });\n`,
  // the stateful class: a plain step sequence, and a repro built from the project's own test helper
  'repro_cart_remove.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { Cart } from '${toSrc}/cart.js';\ntest('repro_cart_remove', () => { const c = new Cart(); c.add('a', 100, 3); c.remove('a', 1); assert.equal(c.quantity('a'), 2); });\n`,
  'repro_cart_negative.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { makeCart } from '${toSrc}/../test/helpers.mjs';\ntest('repro_cart_negative', () => { const c = makeCart(); c.applyDiscount(150); c.remove('apple', 2); assert.ok(c.total() >= 0, String(c.total())); });\n`,
  'repro_cart_missing.test.mjs': `import test from 'node:test';\nimport { Cart } from '${toSrc}/cart.js';\ntest('repro_cart_missing', () => { new Cart().remove('nope'); });\n`,
});

const f = (title, fn, repro, kind = 'wrong-result') => ({
  title, function: fn, kind, property: title, property_test: '', repro_file: repro,
  input: 'see repro', expected: 'see repro', actual: 'see repro', evidence: 'doc comment',
});

// Express API fixture: repros drive the app over a loopback server, as the hunter is told to.
const JSAPI = (toSrc) => {
  const head = `import test, { before, after } from 'node:test';\nimport assert from 'node:assert/strict';\nimport app from '${toSrc}/app.js';\nlet server, base;\nbefore(() => { server = app.listen(0); base = \`http://127.0.0.1:\${server.address().port}\`; });\nafter(() => server.close());\nconst json = (method, url, body) => fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });\n`;
  return {
    'repro_api_unknown.test.mjs': head + "test('repro_api_unknown', async () => { const r = await json('GET', '/items/999999'); assert.equal(r.status, 404); });\n",
    'repro_api_put_twice.test.mjs': head + "test('repro_api_put_twice', async () => { const item = await (await json('POST', '/items', { name: 'a', price: 1 })).json(); const body = { name: 'b', price: 2 }; const first = await (await json('PUT', `/items/${item.id}`, body)).json(); const second = await (await json('PUT', `/items/${item.id}`, body)).json(); assert.deepEqual(first, second); });\n",
    // built on the project's own test helper
    'repro_api_paging.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { startApp } from '${toSrc}/../test/helpers.mjs';\ntest('repro_api_paging', async () => { const { base, stop } = startApp(); try { const ids = []; for (let i = 0; i < 3; i++) ids.push((await (await fetch(base + '/items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x', price: 1 }) })).json()).id); const p1 = (await (await fetch(base + '/items?offset=0&limit=2')).json()).map((i) => i.id); const p2 = (await (await fetch(base + '/items?offset=2&limit=2')).json()).map((i) => i.id); assert.deepEqual([...p1, ...p2].sort(), ids.sort()); } finally { stop(); } });\n`,
    'repro_api_negative.test.mjs': head + "test('repro_api_negative', async () => { const r = await json('POST', '/items', { name: 'a', price: -1 }); assert.equal(r.status, 201); });\n",
  };
};

export default async function fakeAgent({ prompt, cwd }) {
  if (prompt.includes("counterhound's bug hunter") && prompt.includes('HTTP API (express')) {
    const dir = path.join(cwd, prompt.match(/Create files only inside `([^`]+)\/`/)[1]);
    const toSrc = path.relative(dir, path.join(cwd, 'src')).split(path.sep).join('/');
    for (const need of ['app `src/app.js:app`', '`GET /items/:id` → `inline handler`', `import app from '${toSrc}/app.js'`, 'test/helpers.mjs: `startApp`']) {
      if (!prompt.includes(need)) throw new Error(`api prompt lacks: ${need}`);
    }
    for (const [name, src] of Object.entries(JSAPI(toSrc))) fs.writeFileSync(path.join(dir, name), src);
    fs.writeFileSync(path.join(dir, 'findings.json'), JSON.stringify([
      f('GET /items/:id returns 200 with an empty object for an unknown id', 'GET /items/:id', 'repro_api_unknown.test.mjs'),
      f('PUT is not idempotent: version changes on a no-op update', 'PUT /items/:id', 'repro_api_put_twice.test.mjs'),
      f('GET /items paging drops the last item of every page', 'GET /items', 'repro_api_paging.test.mjs'),
      f('POST /items rejects a negative price', 'POST /items', 'repro_api_negative.test.mjs'),
    ]));
    return 'reported 4 bugs';
  }
  if (prompt.includes("counterhound's bug hunter")) {
    const dir = path.join(cwd, prompt.match(/Create files only inside `([^`]+)\/`/)[1]);
    const isGo = prompt.includes('Go + rapid');
    const isJava = prompt.includes('Java + JUnit 5');
    const isJs = prompt.includes('fast-check');
    const toSrc = path.relative(dir, path.join(cwd, 'src')).split(path.sep).join('/');
    const files = isJs ? JS(toSrc) : isJava ? JAVA : isGo ? GO : RUST;
    for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), src);
    const findings = isJs ? [
      f('uniqueBy keeps the last duplicate', 'uniqueBy', 'repro_unique.test.mjs'),
      f('truncate exceeds max', 'truncate', 'repro_truncate.test.mjs'),
      f('rangeInclusive throws on step 0', 'rangeInclusive', 'repro_range.test.mjs', 'crash'),
      f('bogus: test bug', 'page', 'repro_testbug.test.mjs', 'crash'),
      f('bogus: build', 'page', 'repro_build.test.mjs'),
      f('bogus: random', 'page', 'repro_random.test.mjs'),
      f('bogus: passes', 'camelToSnake', 'repro_passes.test.mjs'),
      f('Cart.remove ignores qty and drops the whole line', 'Cart.remove', 'repro_cart_remove.test.mjs'),
      f('Cart.total goes negative after a discount when lines are removed', 'Cart.total', 'repro_cart_negative.test.mjs'),
      f('Cart.remove throws on an unknown sku', 'Cart.remove', 'repro_cart_missing.test.mjs', 'crash'),
    ] : isJava ? [
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
    const jsFile = (prompt.match(/^File: (src\/\w+\.js)$/m) || [])[1];
    if (isJs && jsFile === 'src/cart.js' && !(prompt.includes('Stateful classes') && prompt.includes('test/helpers.mjs: `makeCart`'))) throw new Error('cart prompt lacks the stateful class or the helper');
    const mine = isJs ? findings.filter((x) => jsFile === (/truncate|camelToSnake/.test(x.function) ? 'src/text.js' : /^Cart\./.test(x.function) ? 'src/cart.js' : 'src/arrays.js'))
      : isJava ? findings.filter((x) => x.function.includes('.Range.') === inRange)
      : isGo ? findings : findings.filter((x) => x.function.includes('::stats::') === inStats);
    fs.writeFileSync(path.join(dir, 'findings.json'), JSON.stringify(mine));
    return `reported ${findings.length} bugs`;
  }
  if (prompt.includes('You are fixing a confirmed bug')) {
    // cwd is the sandbox copy of the JS fixture: fix truncate, and (to be rejected) also edit an existing test
    const file = path.join(cwd, 'src', 'text.js');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace("return s.slice(0, max) + '…';", "return s.slice(0, Math.max(0, max - 1)) + '…';"));
    if (prompt.includes('uniqueBy')) {
      const a = path.join(cwd, 'src', 'arrays.js');
      fs.writeFileSync(a, fs.readFileSync(a, 'utf8').replace('seen.set(keyFn(item), item)', 'if (!seen.has(keyFn(item))) seen.set(keyFn(item), item)'));
      fs.writeFileSync(path.join(cwd, 'test', 'arrays.test.mjs'), '// weakened\n');
    }
    return 'fixed';
  }
  if (prompt.includes('skeptical, experienced maintainer')) {
    if (/MustPositive|parse_percent|parsePercent|chunk panics on zero|rangeInclusive|unknown sku|negative price/.test(prompt)) return '{"verdict":"not_a_bug","confidence":0.9,"severity":"low","category":"crash","title":"x","reason":"Documented.","maintainer_would_fix":false}';
    return '{"verdict":"bug","confidence":0.9,"severity":"medium","category":"wrong-result","title":"confirmed","reason":"Contradicts the doc comment.","maintainer_would_fix":true}';
  }
  throw new Error('unexpected prompt');
}
