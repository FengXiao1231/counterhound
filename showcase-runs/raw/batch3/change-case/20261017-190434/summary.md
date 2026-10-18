<!-- counterhound-report -->
### counterhound found 1 provable bug (1 with a verified fix)

Checked 7 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Capitalisation splits surrogate pairs, so words starting with astral cased letters are not capitalised <sub>(wrong result, packages/change-case/src/index.ts)</sub></summary>

| | |
|---|---|
| Function | `pascalSnakeCase (via capitalCaseTransformFactory; also pascalCase/camelCase)` |
| Input | pascalSnakeCase('\u{10428}a', {locale:false}) |
| Expected | '\u{10400}a' (first letter uppercased) |
| Actual | '\u{10428}a' (unchanged) |
| Review | low severity, confidence 0.80 |

The splitter uses \p{L} with the u flag, so an astral letter such as U+10428 is a valid word character. capitalCaseTransformFactory and pascalCaseTransformFactory then take word[0] and word.slice(1), which cut the surrogate pair in half. toUpperCase on a lone surrogate does nothing, so the first letter stays lowercase and the documented 'Foo_Bar' capitalisation is not applied. The input is valid and the repro is correct. A fix is small (use the first code point, e.g. String.fromCodePoint(word.codePointAt(0)) or Array.from), though the affected scripts (Deseret, Osage, Adlam and similar) are ra

Failing test (`repro_astral_capitalize.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { pascalSnakeCase } from '../../../../../packages/change-case/src/index.ts';

test('repro_astral_capitalize', () => {
  // U+10428 DESERET SMALL LETTER LONG I; its uppercase is U+10400
  assert.equal(pascalSnakeCase('\u{10428}a', { locale: false }), '\u{10400}a');
});
```

Suggested fix (the repro passes with it; project tests not run (no test command found; set "testCommand" in .counterhound/config.json)):

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
</details>

<sub>1m08s · $0.38 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
