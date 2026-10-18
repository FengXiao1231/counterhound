# MakeLang returns an empty slug when EnableSmartTruncate=false and MaxLength is 0 (the default)

| | |
|---|---|
| Function | `github.com/gosimple/slug.MakeLang` in `slug.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.93, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** EnableSmartTruncate=false, MaxLength=0, Make("a")

**Expected:** "a"

**Actual:** "" (slug[:0] since len(slug) >= MaxLength is true)

## Reproduce

```go
package slug

import "testing"

func TestReproNonSmartZeroMaxLength(t *testing.T) {
	EnableSmartTruncate = false
	defer func() { EnableSmartTruncate = true }()
	if got := Make("a"); got != "a" {
		t.Fatalf("Make(\"a\") with MaxLength=0 and smart truncate off = %q, want \"a\"", got)
	}
}
```

Fails with `AssertionError: Make("a") with MaxLength=0 and smart truncate off = "", want "a"`

Copy it into the package directory as `repro_nonsmart_zero_maxlength_test.go` and run `go test -run Repro .`.

## Why this is a bug

Doc on MaxLength: 'By default slugs aren't shortened.' The non-smart branch `len(slug) >= MaxLength` does not guard MaxLength > 0 (unlike the smart branch).

Independent review: slug.go:131 runs `if !EnableSmartTruncate && len(slug) >= MaxLength { slug = slug[:MaxLength] }` with no `MaxLength > 0` check. With the default MaxLength=0, `len(slug) >= 0` is always true, so every slug is cut to `slug[:0]` and comes back empty. The MaxLength doc says 'By default slugs aren't shortened', and the smart branch at line 144 guards with `MaxLength > 0`, so the missing guard is an oversight and not intended. The repro uses the public API correctly, and a one-line fix is trivial for a maintainer to accept.

## How it was found

Property: *With MaxLength unset (0), slugs are not shortened, so a simple lowercase word is returned unchanged regardless of EnableSmartTruncate*.

rapid shrank the failure to: `Failing test case: s: "a"`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
