# Bengali to_currency treats paisa values 0.01–0.09 as 10–90 paisa (leading zero dropped)

| | |
|---|---|
| Function | `num2words.lang_BN.Num2Word_BN.to_currency` in `num2words/lang_BN.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.93, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** to_currency('0.01')

**Expected:** শূন্য টাকা এক পয়সা

**Actual:** শূন্য টাকা দশ পয়সা

## Reproduce

```python
from num2words.lang_BN import Num2Word_BN


def test_repro_paisa_leading_zero():
    # 0.01 taka is one paisa, not ten
    assert Num2Word_BN().to_currency('0.01') == 'শূন্য টাকা এক পয়সা'
```

Fails with `AssertionError: assert 'শূন্য টাকা দশ পয়সা' == 'শূন্য টাকা এক পয়সা'`

Save it as `test_repro_paisa_leading_zero.py` in your tests and run `pytest test_repro_paisa_leading_zero.py`.

## Suggested fix

The repro passes with this patch; the project's tests not compared (the suite already fails without the fix: python3 -m pytest -q -x -p no:cacheprovider --no-header). Apply it with `git apply fix.patch`.

```diff
diff --git a/num2words/lang_BN.py b/num2words/lang_BN.py
index ef86ed7..9d145e0 100644
--- a/num2words/lang_BN.py
+++ b/num2words/lang_BN.py
@@ -75,7 +75,7 @@ class Num2Word_BN:
 
         # this is need, when we parse to decimal it removes trailing 0 .
         if paisa_str:
-            paisa_str = str(int(paisa_str) * 100)[:2]
+            paisa_str = (paisa_str + '00')[:2]
         return int(number), int(paisa_str)
 
     def _is_smaller_than_max_number(self, number):
```

## Why this is a bug

parse_paisa does int('01')*100 -> '10'; 1 paisa = 0.01 taka. Docstring example 9999.15 -> পনের পয়সা shows the two decimals are paisa.

Independent review: `parse_paisa` takes the fractional digits as a string and computes `str(int('01') * 100)[:2]`. The leading zero is lost, so '01' becomes 100 and then '10'. Any 0.0X input is therefore spoken as X0 paisa, and 1.005 would come out as 50 paisa. Existing tests only cover fractions of 0.10 or more (20.50, 33.51, 10000.1), so nothing depends on this behaviour. A maintainer would accept a fix that pads or truncates the fraction to two digits, e.g. `(frac_str + '00')[:2]`.

## How it was found

Property: *the paisa part of 'T.PP' is spoken as the integer PP*.

Hypothesis shrank the failure to: `Failing test case: test_currency_paisa_exact( taka=0, # or any other generated value paisa=1, )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
