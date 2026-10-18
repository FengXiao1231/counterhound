# Compare ignores prerelease when segment counts differ (e.g. 1.0.0.0-alpha vs 1.0.0)

| | |
|---|---|
| Function | `github.com/hashicorp/go-version.(*Version).Compare` in `version.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** a=1.0.0-alpha, b=1.0.0.0-alpha, c=1.0.0

**Expected:** 1.0.0.0-alpha < 1.0.0 (as 1.0.0-alpha < 1.0.0), since trailing zero segments are treated as equal

**Actual:** 1.0.0.0-alpha.Compare(1.0.0) == 0 while 1.0.0-alpha.Compare(1.0.0) == -1, so Equal is non-transitive (1.0.0-alpha == 1.0.0.0-alpha == 1.0.0 but 1.0.0-alpha != 1.0.0)

## Reproduce

```go
package version

import "testing"

func TestReproPrereleaseIgnoredWithExtraSegment(t *testing.T) {
	pre := Must(NewVersion("1.0.0-alpha"))
	padded := Must(NewVersion("1.0.0.0-alpha"))
	rel := Must(NewVersion("1.0.0"))

	if pre.Compare(rel) != -1 {
		t.Fatalf("precondition: 1.0.0-alpha should be < 1.0.0")
	}
	if got := padded.Compare(rel); got != -1 {
		t.Fatalf("1.0.0.0-alpha.Compare(1.0.0) = %d, want -1", got)
	}
	if got := rel.Compare(padded); got != 1 {
		t.Fatalf("1.0.0.Compare(1.0.0.0-alpha) = %d, want 1", got)
	}
}
```

Fails with `AssertionError: 1.0.0.0-alpha.Compare(1.0.0) = 0, want -1`

Copy it into the package directory as `repro_prerelease_ignored_extra_segment_test.go` and run `go test -run Repro .`.

## Why this is a bug

Compare's own jagged-segment logic treats missing trailing segments as zeros (1.0 == 1.0.0 including prerelease handling via equalSegments only when lengths match); the fallthrough path returns 0 without ever comparing prereleases, violating SemVer precedence and the total-order contract that sort/Equal rely on.

Independent review: Prerelease is only compared inside the `equalSegments` branch, which requires equal segment counts. When counts differ, such as a 4-segment version against a 3-segment one, the jagged-segment loop treats the trailing zeros as equal and returns 0 without looking at prerelease. So `1.0.0.0-alpha` equals both `1.0.0` and `1.0.0.0-beta`, while `1.0.0-alpha < 1.0.0`. That makes Equal and sort ordering non-transitive, and nothing in the code or docs suggests this is intentional. The trigger is niche (4 or more segments plus a prerelease), but the fix is small: run the prerelease comparison after the segment loop finishes without finding a difference.

## How it was found

Property: *A prerelease version is lower than the same segments without prerelease, regardless of trailing zero-padding of segments; equality is consistent/transitive*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
