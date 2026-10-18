# WrapString with lim=1 never breaks between single-character words

| | |
|---|---|
| Function | `github.com/mitchellh/go-wordwrap.WrapString` in `wordwrap.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.60, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** WrapString("a b", 1)

**Expected:** "a\nb" (each one-character word fits the limit on its own line)

**Actual:** "a b" (a 3-wide line with lim=1)

## Reproduce

```go
package wordwrap

import "testing"

func TestReproLim1NoWrap(t *testing.T) {
	got := WrapString("a b", 1)
	if want := "a\nb"; got != want {
		t.Fatalf("WrapString(%q, 1) = %q, want %q", "a b", got, want)
	}
}
```

Fails with `AssertionError: WrapString("a b", 1) = "a b", want "a\nb"`

Copy it into the package directory as `repro_lim1_nowrap_test.go` and run `go test -run Repro .`.

## Why this is a bug

Doc: 'WrapString wraps the given string within lim width in characters'; only words longer than lim are described as pathological. The condition `wordBufLen < lim` at line 64 is false for a one-character word when lim == 1, so the break is skipped even though the word fits on a fresh line.

Independent review: The guard `wordBufLen < lim` at line 64 exists to avoid breaking a word that already can't fit. When lim==1, the first character of every word has wordBufLen==1, so the guard is always false and no break is ever emitted. As a result, "a b" stays on one line even though each word fits on its own. For lim>=2 the first character of a word always satisfies `wordBufLen < lim`, so only lim==1 is affected. The docstring only excuses overruns for words longer than the limit, and that does not apply here. This is a real off-by-one in the guard, but lim=1 is a degenerate input and the fix is trivial, so severity is low.

## How it was found

Property: *in the output, any line containing more than one word is no wider than lim when every word fits within lim*.

rapid shrank the failure to: `Failing test case: s: "a\ta", lim: 0x1`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
