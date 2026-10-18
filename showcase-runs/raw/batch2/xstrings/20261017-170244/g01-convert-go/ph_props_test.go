package xstrings

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func phAlnum() *rapid.Generator[string] {
	return rapid.StringMatching(`[A-Za-z0-9_\- ]{0,14}`)
}

func TestPhSnakeKebabAgree(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phAlnum().Draw(t, "s")
		sn := ToSnakeCase(s)
		kb := ToKebabCase(s)
		if strings.ReplaceAll(sn, "_", "-") != kb {
			t.Fatalf("%q snake=%q kebab=%q", s, sn, kb)
		}
	})
}

func TestPhSnakeIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z0-9_ ]{0,14}`).Draw(t, "s")
		a := ToSnakeCase(s)
		if b := ToSnakeCase(a); a != b {
			t.Fatalf("%q -> %q -> %q", s, a, b)
		}
	})
}

func TestPhSnakeKeepsAlnum(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phAlnum().Draw(t, "s")
		f := func(x string) string {
			var b strings.Builder
			for _, r := range strings.ToLower(x) {
				if r != '_' && r != '-' && r != ' ' {
					b.WriteRune(r)
				}
			}
			return b.String()
		}
		if f(s) != f(ToSnakeCase(s)) {
			t.Fatalf("%q -> %q", s, ToSnakeCase(s))
		}
	})
}

func TestPhSnakeLower(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phAlnum().Draw(t, "s")
		o := ToSnakeCase(s)
		if o != strings.ToLower(o) {
			t.Fatalf("%q -> %q", s, o)
		}
	})
}

func TestPhCamelPascalRelation(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phAlnum().Draw(t, "s")
		c := ToCamelCase(s)
		p := ToPascalCase(s)
		if len(c) != len(p) || strings.ToLower(c) != strings.ToLower(p) {
			t.Fatalf("%q camel=%q pascal=%q", s, c, p)
		}
		if FirstRuneToUpper(c) != p {
			t.Fatalf("%q camel=%q pascal=%q", s, c, p)
		}
	})
}

func TestPhCamelIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phAlnum().Draw(t, "s")
		a := ToCamelCase(s)
		if b := ToCamelCase(a); a != b {
			t.Fatalf("%q -> %q -> %q", s, a, b)
		}
	})
}

func TestPhSwapCaseInvolutionASCII(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[ -~]{0,20}`).Draw(t, "s")
		if SwapCase(SwapCase(s)) != s {
			t.Fatalf("%q", s)
		}
	})
}

func TestPhFirstRuneToUpper(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[ -~]{0,10}`).Draw(t, "s")
		o := FirstRuneToUpper(s)
		if s == "" {
			return
		}
		if len(s) != len(o) || s[1:] != o[1:] || strings.ToUpper(s[:1]) != o[:1] && s[:1] != o[:1] {
			t.Fatalf("%q -> %q", s, o)
		}
	})
}

func TestPhNoCrash(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		ToSnakeCase(s)
		ToKebabCase(s)
		ToCamelCase(s)
		ToPascalCase(s)
		SwapCase(s)
		FirstRuneToUpper(s)
	})
}
