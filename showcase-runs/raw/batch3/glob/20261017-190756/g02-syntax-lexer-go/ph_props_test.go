package syntax

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func phQuote(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if IsSpecial(s[i]) {
			b.WriteByte('\\')
		}
		b.WriteByte(s[i])
	}
	return b.String()
}

func phLexAll(src string) []Token {
	l := NewLexer(src)
	var out []Token
	for i := 0; i < 4*len(src)+10; i++ {
		tk := l.Next()
		out = append(out, tk)
		if tk.Type == EOF || tk.Type == Error {
			return out
		}
	}
	return nil
}

func TestPhIsSpecialSet(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		c := rapid.Byte().Draw(t, "c")
		want := strings.IndexByte("*?\\[]{}", c) >= 0
		if IsSpecial(c) != want {
			t.Fatalf("IsSpecial(%q)=%v", c, !want)
		}
	})
}

func TestPhQuoteRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		toks := phLexAll(phQuote(s))
		if toks == nil {
			t.Fatalf("no termination")
		}
		var want []Token
		if s != "" {
			want = append(want, Token{Text, s})
		}
		want = append(want, Token{EOF, ""})
		if len(toks) != len(want) || toks[0] != want[0] {
			t.Fatalf("quote=%q got %v want %v", phQuote(s), toks, want)
		}
	})
}

func TestPhArbitraryTerminates(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringOf(rapid.SampledFrom([]rune("ab*?[]{}\\,!-\x00é"))).Draw(t, "s")
		if phLexAll(s) == nil {
			t.Fatalf("no termination")
		}
		l := NewLexer(s)
		for {
			tk := l.Next()
			if tk.Type == Text && tk.Data == "" {
				t.Fatalf("empty text")
			}
			if tk.Type == EOF || tk.Type == Error {
				for i := 0; i < 3; i++ {
					if l.Next() != tk {
						t.Fatalf("not repeated")
					}
				}
				break
			}
		}
	})
}

func TestPhNulValid(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringOf(rapid.SampledFrom([]rune("a\x00*"))).Draw(t, "s")
		toks := phLexAll(s)
		if toks[len(toks)-1].Type == Error {
			t.Fatalf("error on valid %q: %v", s, toks)
		}
	})
}

func TestPhInvalidUTF8(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		pre := rapid.StringOf(rapid.SampledFrom([]rune("ab*?[{,}"))).Draw(t, "p")
		s := pre + "\xff"
		toks := phLexAll(s)
		if toks[len(toks)-1].Type != Error {
			t.Fatalf("no error for %q: %v", s, toks)
		}
	})
}
