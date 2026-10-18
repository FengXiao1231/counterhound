package glob

import (
	"testing"

	"pgregory.net/rapid"
)

func TestPhNoSepsNil(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringOf(rapid.SampledFrom([]rune("*?[]{}\\!-,a/é世"))).Draw(t, "s")
		p, err := Compile(s)
		if err != nil {
			t.Skip()
		}
		if p.Separators() != nil {
			t.Fatalf("not nil: %#v", p.Separators())
		}
	})
}

func TestPhSepsAliasUnaffected(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		sep := []rune{'/', '.'}
		p := MustCompile("a*b", sep...)
		in := "a/b"
		before := p.Match(in)
		sep[0] = 'x'
		if p.Match(in) != before {
			t.Fatal("match changed after mutating caller slice")
		}
	})
}

func TestPhQuoteMetaUnicodeSeps(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		r := rapid.SampledFrom([]rune("*?[]{}\\a世")).Draw(t, "sepr")
		p, err := Compile(QuoteMeta(s), r)
		if err != nil || !p.Match(s) {
			t.Fatalf("%q sep %q err %v", s, r, err)
		}
		if p.Match(s+"x") || (len(s) > 0 && p.Match(s[:len(s)-1])) {
			t.Fatalf("overmatch %q", s)
		}
	})
}
