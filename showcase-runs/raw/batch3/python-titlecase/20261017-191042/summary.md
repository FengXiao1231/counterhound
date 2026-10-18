<!-- counterhound-report -->
### counterhound found 1 provable bug (1 with a verified fix)

Checked 6 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> set_small_word_list() rebuilds SUBPHRASE without the dash separators used at import <sub>(wrong result, titlecase/__init__.py)</sub></summary>

| | |
|---|---|
| Function | `titlecase.set_small_word_list` |
| Input | titlecase('foo - the end') before vs after set_small_word_list() |
| Expected | 'Foo - The End' both before and after (default list is unchanged) |
| Actual | After set_small_word_list(), result is 'Foo - the End' |
| Review | low severity, confidence 0.90 |

At import, SUBPHRASE is `([:.;?!\-–‒—―][ ])(SMALL)`. `set_small_word_list()` rebuilds it as `([:.;?!][ ])(small)`, so the dash characters are dropped. Calling it with the default list therefore changes output: 'foo - the end' goes from 'Foo - The End' to 'Foo - the End'. The existing test comment says calling it 'should be the case that one could call titlecase.set_small_word_list() and reset to the original behavior', and that test is skipped with a FIXME for this same divergence. The repro is valid, and a maintainer would accept the one-line regex fix.

Failing test (`test_repro_set_small_default.py`, failed 3/3 runs):

```python
from titlecase import titlecase, set_small_word_list


def test_repro_set_small_default():
    text = "foo - the end"
    before = titlecase(text)
    try:
        set_small_word_list()  # default arg == built-in SMALL list
        after = titlecase(text)
    finally:
        set_small_word_list()
    assert before == after
```

Suggested fix (the repro passes with it; project tests not run (no test command found; set "testCommand" in .counterhound/config.json)):

```diff
diff --git a/titlecase/__init__.py b/titlecase/__init__.py
index fd24431..86bb01f 100755
--- a/titlecase/__init__.py
+++ b/titlecase/__init__.py
@@ -74,7 +74,7 @@ def set_small_word_list(small=SMALL):
     SMALL_WORDS = regex.compile(r'^(%s)$' % small, regex.I)
     SMALL_FIRST = regex.compile(r'^([%s]*)(%s)\b' % (PUNCT, small), regex.I)
     SMALL_LAST = regex.compile(r'\b(%s)[%s]?$' % (small, PUNCT), regex.I)
-    SUBPHRASE = regex.compile(r'([:.;?!][ ])(%s)' % small)
+    SUBPHRASE = regex.compile(r'([:.;?!\-–‒—―][ ])(%s)' % small)
 
 
 def titlecase(text, callback=None, small_first_last=True, preserve_blank_lines=False, normalise_space_characters=False):
```
</details>

<sub>1m13s · $0.39 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
