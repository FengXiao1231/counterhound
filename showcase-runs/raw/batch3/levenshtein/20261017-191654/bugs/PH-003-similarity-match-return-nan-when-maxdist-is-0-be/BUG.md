# Similarity/Match return NaN when maxDist is 0 because of zero edit costs

| | |
|---|---|
| Function | `github.com/agext/levenshtein.Match` in `levenshtein.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** Similarity("", "a", NewParams().InsCost(0)) and Match with the same params

**Expected:** a score in the range 0..1

**Actual:** NaN (0/0, since maxDist is 0 and dist is 0)

## Reproduce

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

Fails with `AssertionError: score for "" vs "a" with InsCost(0) = NaN, want within 0..1`

Copy it into the package directory as `repro_nan_test.go` and run `go test -run Repro .`.

## Why this is a bug

Docs: 'The score is in the range of 0..1'; costs 'must be zero or positive' so 0 is explicitly allowed; the code comment shows the author intends to avoid divByZero issues but only guards the both-empty case.

Independent review: InsCost(0) is documented as valid ("must be zero or positive"), and Match is documented to return a score in 0..1. For ("", "a") with InsCost(0), l1=0 and l2=1, so maxDist = 0*delCost + 1*0 = 0 and dist = 0. Line 276 then computes 1 - 0/0, which is NaN. The only guard is the both-empty shortcut at line 230, and its comment says it exists to avoid divide-by-zero. The same case can arise with other zero-cost configurations. A maintainer would likely accept a small fix that returns 1, or a defined value, when maxDist == 0.

## How it was found

Property: *Similarity and Match always return a score in 0..1 for valid (non-negative) costs*.

rapid shrank the failure to: `Failing test case: a: []int32{}, b: []int32{97}, i: 0, s: 0, d: 0, m: false`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
