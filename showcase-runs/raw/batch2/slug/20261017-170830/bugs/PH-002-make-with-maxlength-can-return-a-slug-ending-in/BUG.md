# Make() with MaxLength can return a slug ending in '_' that fails IsSlug

| | |
|---|---|
| Function | `github.com/gosimple/slug.MakeLang` in `slug.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** MaxLength=2, Make("0_0")

**Expected:** a slug without trailing '_' (e.g. "0") that passes IsSlug

**Actual:** "0_", IsSlug returns false

## Reproduce

```go
package slug

import "testing"

func TestReproTruncateTrailingUnderscore(t *testing.T) {
	MaxLength = 2
	defer func() { MaxLength = 0 }()
	got := Make("0_0")
	if got != "" && !IsSlug(got) {
		t.Fatalf("Make(\"0_0\") with MaxLength=2 = %q, not a valid slug", got)
	}
}
```

Fails with `AssertionError: Make("0_0") with MaxLength=2 = "0_", not a valid slug`

Copy it into the package directory as `repro_truncate_trailing_underscore_test.go` and run `go test -run Repro .`.

## Why this is a bug

IsSlug doc: 'All output from slug.Make(text) should pass this test' and slugs may not end with '-' or '_'. smartTruncate cuts text[:MaxLength] without re-trimming '_' / '-'.

Independent review: The IsSlug doc says all output from Make should pass it, and IsSlug rejects a trailing '_' or '-'. With smart truncation, Make trims the ends first and then calls smartTruncate. smartTruncate cuts at `text[:MaxLength]`, or at the last '-', without re-trimming. So "0_0" with MaxLength=2 becomes "0_", and a cut at a '-' can leave a trailing '_' in the same way. The input is ordinary, the guarantee is documented, and re-trimming `-_` after truncation is a small fix a maintainer would accept.

## How it was found

Property: *All output of Make(text) passes IsSlug (when non-empty)*.

rapid shrank the failure to: `Failing test case: s: "0_z", m: 2`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
