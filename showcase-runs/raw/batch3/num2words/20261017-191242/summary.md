<!-- counterhound-report -->
### counterhound found 2 provable bugs (2 with a verified fix)

Checked 12 functions in 2 modules with property-based tests. 2 reported → 2 reproduced → 2 unique → 2 confirmed by an independent review.

<details><summary><b>PH-001</b> Bengali to_currency treats paisa values 0.01–0.09 as 10–90 paisa (leading zero dropped) <sub>(wrong result, num2words/lang_BN.py)</sub></summary>

| | |
|---|---|
| Function | `num2words.lang_BN.Num2Word_BN.to_currency` |
| Input | to_currency('0.01') |
| Expected | শূন্য টাকা এক পয়সা |
| Actual | শূন্য টাকা দশ পয়সা |
| Review | medium severity, confidence 0.93 |

`parse_paisa` takes the fractional digits as a string and computes `str(int('01') * 100)[:2]`. The leading zero is lost, so '01' becomes 100 and then '10'. Any 0.0X input is therefore spoken as X0 paisa, and 1.005 would come out as 50 paisa. Existing tests only cover fractions of 0.10 or more (20.50, 33.51, 10000.1), so nothing depends on this behaviour. A maintainer would accept a fix that pads or truncates the fraction to two digits, e.g. `(frac_str + '00')[:2]`.

Failing test (`test_repro_paisa_leading_zero.py`, failed 3/3 runs):

```python
from num2words.lang_BN import Num2Word_BN


def test_repro_paisa_leading_zero():
    # 0.01 taka is one paisa, not ten
    assert Num2Word_BN().to_currency('0.01') == 'শূন্য টাকা এক পয়সা'
```

Suggested fix (the repro passes with it; project tests not compared (the suite already fails without the fix: python3 -m pytest -q -x -p no:cacheprovider --no-header)):

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
</details>

<details><summary><b>PH-002</b> BN to_cardinal drops leading zeros in the fractional part (1.05 reads the same as 1.5) <sub>(wrong result, num2words/lang_BN.py)</sub></summary>

| | |
|---|---|
| Function | `num2words.lang_BN.Num2Word_BN.to_cardinal` |
| Input | to_cardinal('1.05') |
| Expected | a reading different from 1.5 (e.g. এক দশমিক শূন্য পাঁচ) |
| Actual | এক দশমিক পাঁচ (identical to 1.5) |
| Review | medium severity, confidence 0.90 |

The fraction is read digit by digit (`_dosomik_to_bengali_word` iterates `str(number)`, and the existing tests expect e.g. 1.11 -> 'এক এক'). But `parse_number` runs `int()` on the fractional digit string, which strips leading zeros, so 1.05 and 1.5 both give 'এক দশমিক পাঁচ'. This is a different number read aloud, and no test covers or intends it. A fix is easy: keep the fractional digits as a string and read them with the leading zeros included. `to_currency`/`parse_paisa` has its own separate handling, so the fix doesn't change that.

Failing test (`test_repro_decimal_leading_zero.py`, failed 3/3 runs):

```python
from num2words.lang_BN import Num2Word_BN


def test_repro_decimal_leading_zero():
    # 1.05 and 1.5 must not read the same
    n = Num2Word_BN()
    assert n.to_cardinal('1.05') != n.to_cardinal('1.5')
```

Suggested fix (the repro passes with it; project tests not compared (the suite already fails without the fix: python3 -m pytest -q -x -p no:cacheprovider --no-header)):

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
</details>

<sub>1m52s · $0.64 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
