# BN to_cardinal drops leading zeros in the fractional part (1.05 reads the same as 1.5)

| | |
|---|---|
| Function | `num2words.lang_BN.Num2Word_BN.to_cardinal` in `num2words/lang_BN.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** to_cardinal('1.05')

**Expected:** a reading different from 1.5 (e.g. এক দশমিক শূন্য পাঁচ)

**Actual:** এক দশমিক পাঁচ (identical to 1.5)

## Reproduce

```python
from num2words.lang_BN import Num2Word_BN


def test_repro_decimal_leading_zero():
    # 1.05 and 1.5 must not read the same
    n = Num2Word_BN()
    assert n.to_cardinal('1.05') != n.to_cardinal('1.5')
```

Fails with `AssertionError: assert 'এক দশমিক পাঁচ' != 'এক দশমিক পাঁচ'`

Save it as `test_repro_decimal_leading_zero.py` in your tests and run `pytest test_repro_decimal_leading_zero.py`.

## Suggested fix

The repro passes with this patch; the project's tests not compared (the suite already fails without the fix: python3 -m pytest -q -x -p no:cacheprovider --no-header). Apply it with `git apply fix.patch`.

```diff
diff --git a/num2words/lang_BN.py b/num2words/lang_BN.py
index ef86ed7..699da86 100644
--- a/num2words/lang_BN.py
+++ b/num2words/lang_BN.py
@@ -157,10 +157,15 @@ class Num2Word_BN:
 
         dosomik_word = None
         number = self.str_to_number(number)
+        fraction = str(number - int(number)).split('.')[1:]
         number, decimal_part = self.parse_number(number)
         self._is_smaller_than_max_number(number)
 
         if decimal_part > 0:
+            # parse_number drops the fraction's leading zeros, restore them.
+            fraction = ''.join(fraction)
+            leading_zeros = len(fraction) - len(fraction.lstrip('0'))
+            decimal_part = '0' * leading_zeros + str(decimal_part)
             dosomik_word = f' দশমিক{self._dosomik_to_bengali_word(decimal_part)}'  # noqa: E501
 
         words = self._number_to_bengali_word(number)
```

## Why this is a bug

parse_number converts the fractional string with int(), discarding leading zeros; _dosomik_to_bengali_word reads digit by digit, so the intent is digit-wise reading. 1.05 and 1.5 are different numbers.

Independent review: The fraction is read digit by digit (`_dosomik_to_bengali_word` iterates `str(number)`, and the existing tests expect e.g. 1.11 -> 'এক এক'). But `parse_number` runs `int()` on the fractional digit string, which strips leading zeros, so 1.05 and 1.5 both give 'এক দশমিক পাঁচ'. This is a different number read aloud, and no test covers or intends it. A fix is easy: keep the fractional digits as a string and read them with the leading zeros included. `to_currency`/`parse_paisa` has its own separate handling, so the fix doesn't change that.

## How it was found

Property: *every digit after the decimal point is spoken, including leading zeros*.

Hypothesis shrank the failure to: `Failing test case: test_cardinal_decimal_digits_preserved( whole=0, # or any other generated value frac=1, )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
