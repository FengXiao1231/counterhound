# Capitalisation splits surrogate pairs, so words starting with astral cased letters are not capitalised

| | |
|---|---|
| Function | `pascalSnakeCase (via capitalCaseTransformFactory; also pascalCase/camelCase)` in `packages/change-case/src/index.ts` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** pascalSnakeCase('\u{10428}a', {locale:false})

**Expected:** '\u{10400}a' (first letter uppercased)

**Actual:** '\u{10428}a' (unchanged)

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { pascalSnakeCase } from '../../../../../packages/change-case/src/index.ts';

test('repro_astral_capitalize', () => {
  // U+10428 DESERET SMALL LETTER LONG I; its uppercase is U+10400
  assert.equal(pascalSnakeCase('\u{10428}a', { locale: false }), '\u{10400}a');
});
```

Fails with `AssertionError: Expected values to be strictly equal:`

Run it with `node --test repro_astral_capitalize.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests not run (no test command found; set "testCommand" in .proofhound/config.json). Apply it with `git apply fix.patch`.

```diff
diff --git a/packages/change-case/src/index.ts b/packages/change-case/src/index.ts
index a84701f..3d6fd5d 100644
--- a/packages/change-case/src/index.ts
+++ b/packages/change-case/src/index.ts
@@ -232,7 +232,10 @@ function capitalCaseTransformFactory(
   lower: (input: string) => string,
   upper: (input: string) => string,
 ) {
-  return (word: string) => `${upper(word[0])}${lower(word.slice(1))}`;
+  return (word: string) => {
+    const char0 = String.fromCodePoint(word.codePointAt(0)!);
+    return `${upper(char0)}${lower(word.slice(char0.length))}`;
+  };
 }
 
 function pascalCaseTransformFactory(
@@ -240,10 +243,10 @@ function pascalCaseTransformFactory(
   upper: (input: string) => string,
 ) {
   return (word: string, index: number) => {
-    const char0 = word[0];
+    const char0 = String.fromCodePoint(word.codePointAt(0)!);
     const initial =
       index > 0 && char0 >= "0" && char0 <= "9" ? "_" + char0 : upper(char0);
-    return initial + lower(word.slice(1));
+    return initial + lower(word.slice(char0.length));
   };
 }
```

## Why this is a bug

split() uses \p{L} with the u flag, so astral letters count as word letters, but capitalCaseTransformFactory does upper(word[0]) / word.slice(1), which cuts a surrogate pair in half; toUpperCase of a lone high surrogate is a no-op. Doc: 'Convert a string to pascal snake case (Foo_Bar)'.

Independent review: The splitter uses \p{L} with the u flag, so an astral letter such as U+10428 is a valid word character. capitalCaseTransformFactory and pascalCaseTransformFactory then take word[0] and word.slice(1), which cut the surrogate pair in half. toUpperCase on a lone surrogate does nothing, so the first letter stays lowercase and the documented 'Foo_Bar' capitalisation is not applied. The input is valid and the repro is correct. A fix is small (use the first code point, e.g. String.fromCodePoint(word.codePointAt(0)) or Array.from), though the affected scripts (Deseret, Osage, Adlam and similar) are rare.

## How it was found

Property: *the first letter of each word in pascalSnakeCase output is uppercase when the letter has an uppercase form*.

fast-check shrank the failure to: `Counterexample: ["𐐨a"]`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
