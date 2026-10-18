# Lexer.Offset() points past the end of the class for tokens inside a character class

| | |
|---|---|
| Function | `github.com/gobwas/glob/syntax.Lexer.Next` in `syntax/lexer.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** "[a-c]" (also "[]"): call Next() once, then Offset()

**Expected:** Next() returns RangeOpen and Offset() == 1, right after the '['

**Actual:** Offset() == 5 (2 for "[]"): fetchRange lexes the whole class and queues all its tokens, so pos is already past them

## Reproduce

```go
package syntax

import "testing"

func TestReproOffsetAfterRangeOpen(t *testing.T) {
	l := NewLexer("[a-c]")
	tk := l.Next()
	if tk.Type != RangeOpen {
		t.Fatalf("unexpected token %v", tk)
	}
	if got := l.Offset(); got != 1 {
		t.Fatalf("Offset() after %v = %d, want 1 (right after the returned token)", tk, got)
	}
}
```

Fails with `AssertionError: Offset() after range_open<"["> = 5, want 1 (right after the returned token)`

Copy it into the package directory as `repro_offset_test.go` and run `go test -run Repro .`.

## Why this is a bug

Doc of Offset: 'the byte offset in the source the lexer stopped at, that is, the position right after the most recently returned token.' The parser (parse.go) uses lex.Offset() for error positions, so errors reported at a token inside a class point past it.

Independent review: The doc on Offset() says it is the position right after the most recently returned token. fetchRange (lexer.go:303) lexes the whole class eagerly and queues RangeOpen, Lo, Between, Hi and Close, so after Next() returns RangeOpen for "[a-c]", pos is already 5 instead of 1. Escape-free input is valid, and the repro uses the API correctly. The parser passes lex.Offset() as the error position in parse.go, so errors on tokens inside a class are reported too far along. The impact is small, since it only affects diagnostic offsets, but a maintainer would likely fix it by tracking a per-token end offset, or by lexing the class lazily.

## How it was found

Property: *for escape-free patterns, Offset() after each Next() equals the total source length of the tokens returned so far*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
