# Calculate with maxCost>0 returns an in-budget distance (2) when the true distance is 6

| | |
|---|---|
| Function | `github.com/agext/levenshtein.Calculate` in `levenshtein.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** Calculate("aaa", "bbbab", maxCost=2, insCost=1, subCost=2, delCost=2); also Similarity("aaa","bbbab", InsCost(1).SubCost(2).DelCost(2).MinScore(0.75))

**Expected:** true distance is 6 > maxCost, so Calculate returns a value > 2 (e.g. 3); Similarity with MinScore 0.75 returns 0 (true score 0.25)

**Actual:** Calculate returns 2 (looks like an exact in-budget distance); Similarity with MinScore 0.75 returns 0.75 instead of 0 (without MinScore it returns 0.25)

## Reproduce

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

Fails with `AssertionError: Calculate with maxCost=2 returned 2, but actual distance is 6 (> maxCost)`

Copy it into the package directory as `repro_maxcost_test.go` and run `go test -run Repro .`.

## Why this is a bug

Docstring: 'If maxCost is non-zero, the calculation stops as soon as the distance is determined to be greater than maxCost. Therefore, any return value higher than maxCost is a lower bound for the actual distance.' Implied: a value <= maxCost is exact. Similarity/Match docs: scores lower than MinScore are returned as 0; here a 0.25 score is reported as 0.75.

Independent review: The input is valid (non-negative costs, maxCost=2). By my hand calculation the true distance for "aaa"→"bbbab" with ins=1, sub=2, del=2 is 6: two substitutions, one match and two insertions. The docs promise that only values above maxCost may be lower bounds, so a value ≤ maxCost should be exact. The repro failed when I ran it, and Calculate returned 2, which looks like an exact in-budget distance. That makes Similarity with MinScore=0.75 return 0.75 instead of 0 (the true score is 0.25). The cause is probably the banded pruning in the maxCost path, which runs after the string swap, so the cost asymmetry (ins≠del) is involved. I did not trace the exact line. A maintainer would fix this because it silently gives wrong results.

## How it was found

Property: *with maxCost>0, the result equals the exact distance if that is <= maxCost, otherwise it is a value > maxCost (a lower bound of the true distance)*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
