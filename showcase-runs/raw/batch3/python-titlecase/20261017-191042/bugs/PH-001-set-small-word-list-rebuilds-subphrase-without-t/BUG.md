# set_small_word_list() rebuilds SUBPHRASE without the dash separators used at import

| | |
|---|---|
| Function | `titlecase.set_small_word_list` in `titlecase/__init__.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** titlecase('foo - the end') before vs after set_small_word_list()

**Expected:** 'Foo - The End' both before and after (default list is unchanged)

**Actual:** After set_small_word_list(), result is 'Foo - the End'

## Reproduce

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

Fails with `AssertionError: assert 'Foo - The End' == 'Foo - the End'`

Save it as `test_repro_set_small_default.py` in your tests and run `pytest test_repro_set_small_default.py`.

## Suggested fix

The repro passes with this patch; the project's tests not run (no test command found; set "testCommand" in .proofhound/config.json). Apply it with `git apply fix.patch`.

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

## Why this is a bug

Module-level SUBPHRASE uses [:.;?!\-–‒—―][ ] but set_small_word_list rebuilds it with only [:.;?!][ ], while its default argument is SMALL, the same list used at import; resetting to the default should be a no-op.

Independent review: At import, SUBPHRASE is `([:.;?!\-–‒—―][ ])(SMALL)`. `set_small_word_list()` rebuilds it as `([:.;?!][ ])(small)`, so the dash characters are dropped. Calling it with the default list therefore changes output: 'foo - the end' goes from 'Foo - The End' to 'Foo - the End'. The existing test comment says calling it 'should be the case that one could call titlecase.set_small_word_list() and reset to the original behavior', and that test is skipped with a FIXME for this same divergence. The repro is valid, and a maintainer would accept the one-line regex fix.

## How it was found

Property: *Calling set_small_word_list() with its default (SMALL) leaves titlecase output unchanged*.

Hypothesis shrank the failure to: `Failing test case: test_set_small_default_roundtrip( ws=['foo'], )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
