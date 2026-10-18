package syntax

import (
	"testing"

	"pgregory.net/rapid"
)

// Without escapes, Data is the source text, so Offset after a token must be
// the summed length of the Data of the tokens returned so far.
func TestPhOffsetAfterToken(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringOf(rapid.SampledFrom([]rune("ab*?[]{},!-é"))).Draw(t, "s")
		l := NewLexer(s)
		sum := 0
		for i := 0; i < 100; i++ {
			tk := l.Next()
			if tk.Type == Error {
				return
			}
			sum += len(tk.Data)
			if l.Offset() != sum {
				t.Fatalf("src=%q after %v (token #%d): Offset=%d want %d", s, tk, i, l.Offset(), sum)
			}
			if tk.Type == EOF {
				return
			}
		}
	})
}
