# plural_noun raises IndexError on title-cased 'Son Of A Gun' because postprocess indexes past a shorter result

| | |
|---|---|
| Function | `inflect.engine.plural_noun` in `inflect/__init__.py:2376` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.90, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** engine().plural_noun('Son Of A Gun')

**Expected:** 'Sons Of Guns' (lowercase 'son of a gun' gives 'sons of guns')

**Actual:** `IndexError: list index out of range`

## Reproduce

```python
import inflect


def test_repro_title_case_dual_compound():
    p = inflect.engine()
    assert p.plural_noun("son of a gun") == "sons of guns"
    # Capitalised version of the same phrase must not crash
    assert p.plural_noun("Son Of A Gun") == "Sons Of Guns"
```

Fails with `IndexError: list index out of range`

## Why this is a bug

plural_noun accepts any Word; lowercase 'son of a gun' -> 'sons of guns' is tested in tests/test_pwd.py. The dual-compound branch of _plnoun drops the 'a', so the result has fewer words than the input, and postprocess's per-word capitalisation loop indexes result[index] for each original word, which overruns when the original word 'A' is capitalised.

Independent review: The lowercase 'son of a gun' works and is tested, giving 'sons of guns', and 'Son Of A Gun' is an ordinary non-empty phrase, so it is a valid input. The dual-compound branch drops the 'a', so `result` has 3 words while `orig` has 4. `postprocess`'s capitalisation loop indexes `result[index]` by the original word count and overruns on the last word, which I reproduced as an IndexError at `inflect/__init__.py:2376`. The loop is meant to carry capitalisation over to the result, so it should be bounds-safe. A maintainer would accept a fix such as guarding the index or aligning words.

## How it was found

Property: *plural_noun never raises on a valid non-empty word/phrase, including when the phrase is capitalised*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
