<!-- proofhound-report -->
### proofhound found 3 provable bugs

Checked 10 functions in 2 modules with property-based tests. 3 reported → 3 reproduced → 3 unique → 3 confirmed by an independent review.

<details><summary><b>PH-001</b> Calculate with maxCost>0 returns an in-budget distance (2) when the true distance is 6 <sub>(wrong result, levenshtein.go)</sub></summary>

| | |
|---|---|
| Function | `github.com/agext/levenshtein.Calculate` |
| Input | Calculate("aaa", "bbbab", maxCost=2, insCost=1, subCost=2, delCost=2); also Similarity("aaa","bbbab", InsCost(1).SubCost(2).DelCost(2).MinScore(0.75)) |
| Expected | true distance is 6 > maxCost, so Calculate returns a value > 2 (e.g. 3); Similarity with MinScore 0.75 returns 0 (true score 0.25) |
| Actual | Calculate returns 2 (looks like an exact in-budget distance); Similarity with MinScore 0.75 returns 0.75 instead of 0 (without MinScore it returns 0.25) |
| Review | medium severity, confidence 0.90 |

The input is valid (non-negative costs, maxCost=2). By my hand calculation the true distance for "aaa"→"bbbab" with ins=1, sub=2, del=2 is 6: two substitutions, one match and two insertions. The docs promise that only values above maxCost may be lower bounds, so a value ≤ maxCost should be exact. The repro failed when I ran it, and Calculate returned 2, which looks like an exact in-budget distance. That makes Similarity with MinScore=0.75 return 0.75 instead of 0 (the true score is 0.25). The cause is probably the banded pruning in the maxCost path, which runs after the string swap, so the cos

Failing test (`repro_maxcost_test.go`, failed 3/3 runs):

```go
package levenshtein

import "testing"

// Exact distance "aaa"->"bbbab" with ins=1, sub=2, del=2 is 6.
// With maxCost=2, Calculate must return a value > 2 (a lower bound), not 2.
func TestReproMaxCostFalseWithinBudget(t *testing.T) {
	d, _, _ := Calculate([]rune("aaa"), []rune("bbbab"), 2, 1, 2, 2)
	if d <= 2 {
		t.Fatalf("Calculate with maxCost=2 returned %d, but actual distance is 6 (> maxCost)", d)
	}
	if got := Similarity("aaa", "bbbab", NewParams().InsCost(1).SubCost(2).DelCost(2).MinScore(0.75)); got != 0 {
		t.Fatalf("Similarity with MinScore=0.75 = %v, want 0 (true score 0.25)", got)
	}
}
```
</details>

<details><summary><b>PH-002</b> Match() can return a score above 1 when BonusPrefix is raised after BonusScale <sub>(wrong result, params.go)</sub></summary>

| | |
|---|---|
| Function | `Params.BonusScale` |
| Input | NewParams().BonusScale(0.25).BonusPrefix(10); Match("aaaaaaaaaaaaaaaaaaab", "aaaaaaaaaaaaaaaaaaac", p) |
| Expected | Score <= 1 |
| Actual | Match returns 1.075 |
| Review | medium severity, confidence 0.80 |

The BonusScale doc says the scale is "not allowed to exceed 1 / BonusPrefix" so that the score stays within 0..1. The clamp runs only inside BonusScale (params.go:136), and BonusPrefix (params.go:118) sets the value without re-checking. So `BonusScale(0.25).BonusPrefix(10)` gives prefix*scale = 2.5. Match then computes sim + pl*scale*(1-sim) = 0.95 + 10*0.25*0.05 = 1.075, which is real arithmetic and not a float artefact. The same state can also make the `1 - bonusPrefix*bonusScale` divisor in the minScore pre-computation (levenshtein.go:268) zero or negative. A maintainer would likely fix thi

Failing test (`repro_prefix_after_scale_test.go`, failed 3/3 runs):

```go
package levenshtein

import "testing"

func TestReproPrefixAfterScale(t *testing.T) {
	p := NewParams().BonusScale(0.25).BonusPrefix(10)
	s := Match("aaaaaaaaaaaaaaaaaaab", "aaaaaaaaaaaaaaaaaaac", p)
	if s > 1 {
		t.Fatalf("Match = %v, want <= 1", s)
	}
}
```
</details>

<details><summary><b>PH-003</b> Similarity/Match return NaN when maxDist is 0 because of zero edit costs <sub>(wrong result, levenshtein.go)</sub></summary>

| | |
|---|---|
| Function | `github.com/agext/levenshtein.Match` |
| Input | Similarity("", "a", NewParams().InsCost(0)) and Match with the same params |
| Expected | a score in the range 0..1 |
| Actual | NaN (0/0, since maxDist is 0 and dist is 0) |
| Review | low severity, confidence 0.85 |

InsCost(0) is documented as valid ("must be zero or positive"), and Match is documented to return a score in 0..1. For ("", "a") with InsCost(0), l1=0 and l2=1, so maxDist = 0*delCost + 1*0 = 0 and dist = 0. Line 276 then computes 1 - 0/0, which is NaN. The only guard is the both-empty shortcut at line 230, and its comment says it exists to avoid divide-by-zero. The same case can arise with other zero-cost configurations. A maintainer would likely accept a small fix that returns 1, or a defined value, when maxDist == 0.

Failing test (`repro_nan_test.go`, failed 3/3 runs):

```go
package levenshtein

import (
	"math"
	"testing"
)

func TestReproZeroCostNaN(t *testing.T) {
	p := NewParams().InsCost(0)
	for _, v := range []float64{Similarity("", "a", p), Match("", "a", p)} {
		if math.IsNaN(v) || v < 0 || v > 1 {
			t.Fatalf("score for \"\" vs \"a\" with InsCost(0) = %v, want within 0..1", v)
		}
	}
}
```
</details>

<sub>1m41s · $0.62 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
