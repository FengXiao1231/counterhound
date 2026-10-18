package glob

import (
	"slices"
	"testing"

	"pgregory.net/rapid"
)

func phSeps() *rapid.Generator[[]rune] {
	return rapid.SliceOfN(rapid.SampledFrom([]rune{'/', '.', ':', 'a', '*', '世', '\\', ','}), 0, 3)
}

func phStr() *rapid.Generator[string] {
	return rapid.StringN(0, 12, -1)
}

func phMeta() *rapid.Generator[string] {
	return rapid.StringOf(rapid.SampledFrom([]rune("*?[]{}\\!-,a/é世")))
}

func TestPhQuoteMetaMatchesSelf(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.OneOf(phStr(), phMeta()).Draw(t, "s")
		sep := phSeps().Draw(t, "sep")
		p, err := Compile(QuoteMeta(s), sep...)
		if err != nil {
			t.Fatalf("compile %q: %v", QuoteMeta(s), err)
		}
		if !p.Match(s) {
			t.Fatalf("quoted %q does not match %q", QuoteMeta(s), s)
		}
	})
}

func TestPhQuoteMetaExact(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phMeta().Draw(t, "s")
		o := phMeta().Draw(t, "o")
		p := MustCompile(QuoteMeta(s))
		if p.Match(o) != (o == s) {
			t.Fatalf("pat %q s=%q o=%q got %v", QuoteMeta(s), s, o, p.Match(o))
		}
	})
}

func TestPhQuoteMetaInAlt(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phMeta().Draw(t, "s")
		o := phMeta().Draw(t, "o")
		p, err := Compile("{" + QuoteMeta(s) + "," + QuoteMeta(o) + "}x*")
		if err != nil {
			t.Fatal(err)
		}
		if !p.Match(s+"x") || !p.Match(o+"xyz") {
			t.Fatalf("alt fail %q %q", s, o)
		}
	})
}

func TestPhQuoteMetaConcat(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := phMeta().Draw(t, "a")
		b := phMeta().Draw(t, "b")
		if QuoteMeta(a+b) != QuoteMeta(a)+QuoteMeta(b) {
			t.Fatal("not homomorphic")
		}
		if len(QuoteMeta(a)) < len(a) {
			t.Fatal("shrunk")
		}
	})
}

func TestPhStringAndSeparators(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phMeta().Draw(t, "s")
		sep := phSeps().Draw(t, "sep")
		p, err := Compile(s, sep...)
		if err != nil {
			t.Skip()
		}
		if p.String() != s {
			t.Fatalf("String %q != %q", p.String(), s)
		}
		got := p.Separators()
		if len(sep) == 0 {
			if got != nil {
				t.Fatalf("want nil, got %v", got)
			}
		} else if !slices.Equal(got, sep) {
			t.Fatalf("seps %v != %v", got, sep)
		}
	})
}

func TestPhCompileNoPanic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.OneOf(phMeta(), phStr()).Draw(t, "s")
		sep := phSeps().Draw(t, "sep")
		p, err := Compile(s, sep...)
		if err != nil {
			se, ok := err.(*SyntaxError)
			if !ok {
				t.Fatalf("non-SyntaxError %T", err)
			}
			if se.Offset < 0 || se.Offset > len(s) {
				t.Fatalf("offset %d out of range for %q", se.Offset, s)
			}
			func() {
				defer func() {
					if recover() == nil {
						t.Fatal("MustCompile no panic")
					}
				}()
				MustCompile(s, sep...)
			}()
			return
		}
		in := rapid.OneOf(phMeta(), phStr()).Draw(t, "in")
		p.Match(in)
	})
}

func TestPhStarReference(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		parts := rapid.SliceOfN(rapid.SampledFrom([]string{"a", "b", "/", "*", "**", "?"}), 0, 6).Draw(t, "parts")
		in := rapid.StringOf(rapid.SampledFrom([]rune("ab/"))).Draw(t, "in")
		pat := ""
		for _, p := range parts {
			pat += p
		}
		for i := 0; i+1 < len(parts); i++ {
			if parts[i][0] == '*' && parts[i+1][0] == '*' {
				t.Skip()
			}
		}
		g, err := Compile(pat, '/')
		if err != nil {
			t.Fatal(err)
		}
		var ref func(i, j int) bool
		ref = func(i, j int) bool {
			if i == len(parts) {
				return j == len(in)
			}
			switch parts[i] {
			case "*", "**":
				for k := j; k <= len(in); k++ {
					if parts[i] == "*" && k > j && in[k-1] == '/' {
						break
					}
					if ref(i+1, k) {
						return true
					}
				}
				return false
			case "?":
				return j < len(in) && in[j] != '/' && ref(i+1, j+1)
			default:
				return j < len(in) && in[j] == parts[i][0] && ref(i+1, j+1)
			}
		}
		if g.Match(in) != ref(0, 0) {
			t.Fatalf("pat %q in %q got %v", pat, in, g.Match(in))
		}
	})
}
