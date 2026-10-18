package strcase

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func phIn() *rapid.Generator[string] {
	return rapid.StringMatching(`[A-Za-z0-9 _.\-]{0,12}`)
}

func TestPhSnakeIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phIn().Draw(t, "s")
		a := ToSnake(s)
		if b := ToSnake(a); a != b {
			t.Fatalf("ToSnake(%q)=%q, again=%q", s, a, b)
		}
	})
}

func TestPhKebabIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phIn().Draw(t, "s")
		a := ToKebab(s)
		if b := ToKebab(a); a != b {
			t.Fatalf("ToKebab(%q)=%q, again=%q", s, a, b)
		}
	})
}

func TestPhScreamingIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phIn().Draw(t, "s")
		a := ToScreamingSnake(s)
		if b := ToScreamingSnake(a); a != b {
			t.Fatalf("ToScreamingSnake(%q)=%q, again=%q", s, a, b)
		}
	})
}

func TestPhCaseAndScreaming(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phIn().Draw(t, "s")
		if a := ToSnake(s); a != strings.ToLower(a) {
			t.Fatalf("not lower %q", a)
		}
		if a := ToScreamingKebab(s); a != strings.ToUpper(a) {
			t.Fatalf("not upper %q", a)
		}
		if ToScreamingSnake(s) != strings.ToUpper(ToSnake(s)) {
			t.Fatalf("screaming differs %q", s)
		}
		if strings.ReplaceAll(ToSnake(s), "_", "-") != ToKebab(s) {
			t.Fatalf("kebab differs %q", s)
		}
	})
}

func TestPhNoDoubleDelimiter(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z0-9]{0,12}`).Draw(t, "s")
		a := ToSnake(s)
		if strings.Contains(a, "__") || strings.HasPrefix(a, "_") || strings.HasSuffix(a, "_") {
			t.Fatalf("ToSnake(%q)=%q", s, a)
		}
		if strings.ReplaceAll(a, "_", "") != strings.ToLower(s) {
			t.Fatalf("letters changed %q -> %q", s, a)
		}
	})
}
