<!-- counterhound-report -->
### counterhound found 1 provable bug

Checked 8 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Lexer.Offset() points past the end of the class for tokens inside a character class <sub>(wrong result, syntax/lexer.go)</sub></summary>

| | |
|---|---|
| Function | `github.com/gobwas/glob/syntax.Lexer.Next` |
| Input | "[a-c]" (also "[]"): call Next() once, then Offset() |
| Expected | Next() returns RangeOpen and Offset() == 1, right after the '[' |
| Actual | Offset() == 5 (2 for "[]"): fetchRange lexes the whole class and queues all its tokens, so pos is already past them |
| Review | low severity, confidence 0.80 |

The doc on Offset() says it is the position right after the most recently returned token. fetchRange (lexer.go:303) lexes the whole class eagerly and queues RangeOpen, Lo, Between, Hi and Close, so after Next() returns RangeOpen for "[a-c]", pos is already 5 instead of 1. Escape-free input is valid, and the repro uses the API correctly. The parser passes lex.Offset() as the error position in parse.go, so errors on tokens inside a class are reported too far along. The impact is small, since it only affects diagnostic offsets, but a maintainer would likely fix it by tracking a per-token end offs

Failing test (`repro_offset_test.go`, failed 3/3 runs):

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
</details>

<sub>1m18s · $0.52 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
