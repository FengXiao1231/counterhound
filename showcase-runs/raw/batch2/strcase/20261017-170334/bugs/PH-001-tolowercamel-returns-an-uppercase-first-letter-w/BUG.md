# ToLowerCamel returns an uppercase first letter when the input starts with '_', '-' or '.'

| | |
|---|---|
| Function | `github.com/iancoleman/strcase.ToLowerCamel` in `camel.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.70, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** _some_string

**Expected:** someString

**Actual:** SomeString

## Reproduce

```go
package strcase

import "testing"

func TestReproLowerCamelLeadingSeparator(t *testing.T) {
	if got := ToLowerCamel("_some_string"); got != "someString" {
		t.Fatalf("ToLowerCamel(%q) = %q, want %q", "_some_string", got, "someString")
	}
}
```

Fails with `AssertionError: ToLowerCamel("_some_string") = "SomeString", want "someString"`

Copy it into the package directory as `repro_lowercamel_leading_sep_test.go` and run `go test -run Repro .`.

## Why this is a bug

ToLowerCamel is documented as converting to lowerCamelCase; the existing test shows a leading space is ignored (" some string" -> "someString"), but a leading '_', '-' or '.' sets capNext at i==0 and capitalizes the first letter.

Independent review: ToLowerCamel is documented as converting to lowerCamelCase, and the existing test shows a leading space is ignored (" some string" -> "someString"). A leading '_', '-' or '.' hits the final else branch in toCamelInitCase, which sets capNext for the first letter, so ToLowerCamel("_some_string") returns "SomeString". The repro is valid and fails deterministically, and no test covers leading separators. Leading underscores are common in real identifiers, so the result is inconsistent with the space case and violates the function's name and doc. The reporter's mechanism is slightly off, since capNext is set after the separator and not at i==0. The fix is small, but a maintainer might argue leading separators are unspecified, which is why confidence is moderate.

## How it was found

Property: *the result of ToLowerCamel never starts with an uppercase letter*.

rapid shrank the failure to: `Failing test case: s: "-A"`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
