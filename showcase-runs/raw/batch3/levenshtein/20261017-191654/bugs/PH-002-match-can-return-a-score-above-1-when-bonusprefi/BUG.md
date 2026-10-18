# Match() can return a score above 1 when BonusPrefix is raised after BonusScale

| | |
|---|---|
| Function | `Params.BonusScale` in `params.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** NewParams().BonusScale(0.25).BonusPrefix(10); Match("aaaaaaaaaaaaaaaaaaab", "aaaaaaaaaaaaaaaaaaac", p)

**Expected:** Score <= 1

**Actual:** Match returns 1.075

## Reproduce

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

Fails with `AssertionError: Match = 1.0750000000000002, want <= 1`

Copy it into the package directory as `repro_prefix_after_scale_test.go` and run `go test -run Repro .`.

## Why this is a bug

Doc: 'To guarantee that the similarity score remains in the interval 0..1, this scaling factor is not allowed to exceed 1 / BonusPrefix.' The clamp is only applied inside BonusScale, so a later BonusPrefix(v) (which does not re-clamp) breaks the invariant; Similarity range 0..1 is promised for Match.

Independent review: The BonusScale doc says the scale is "not allowed to exceed 1 / BonusPrefix" so that the score stays within 0..1. The clamp runs only inside BonusScale (params.go:136), and BonusPrefix (params.go:118) sets the value without re-checking. So `BonusScale(0.25).BonusPrefix(10)` gives prefix*scale = 2.5. Match then computes sim + pl*scale*(1-sim) = 0.95 + 10*0.25*0.05 = 1.075, which is real arithmetic and not a float artefact. The same state can also make the `1 - bonusPrefix*bonusScale` divisor in the minScore pre-computation (levenshtein.go:268) zero or negative. A maintainer would likely fix this by re-clamping in BonusPrefix or clamping at use time in Match.

## How it was found

Property: *after any sequence of BonusScale/BonusPrefix calls, Match() stays within 0..1 (scale never exceeds 1/BonusPrefix)*.

rapid shrank the failure to: `Failing test case: sc: 1, pr: 50, s1: "aaaaa", s2: "aaaaaa"`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
