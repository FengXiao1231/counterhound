package strcase

import (
	"testing"

	"pgregory.net/rapid"
)

func TestPhLowerCamelFirstLetterLower(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z_ .-]{0,12}`).Draw(t, "s")
		got := ToLowerCamel(s)
		if len(got) > 0 && got[0] >= 'A' && got[0] <= 'Z' {
			t.Fatalf("ToLowerCamel(%q)=%q starts uppercase", s, got)
		}
	})
}

func TestPhCamelFirstLetterUpper(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z_ .-]{0,12}`).Draw(t, "s")
		got := ToCamel(s)
		if len(got) > 0 && got[0] >= 'a' && got[0] <= 'z' {
			t.Fatalf("ToCamel(%q)=%q", s, got)
		}
	})
}

func TestPhNoSeparators(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z0-9_ .-]{0,12}`).Draw(t, "s")
		for _, f := range []func(string) string{ToCamel, ToLowerCamel} {
			for _, c := range f(s) {
				if c == '_' || c == ' ' || c == '-' || c == '.' {
					t.Fatalf("%q -> %q", s, f(s))
				}
			}
		}
	})
}

func TestPhIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z0-9_ .-]{0,12}`).Draw(t, "s")
		a := ToCamel(s)
		if b := ToCamel(a); a != b {
			t.Fatalf("%q -> %q -> %q", s, a, b)
		}
	})
}
