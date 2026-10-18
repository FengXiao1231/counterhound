package slug

import (
	"testing"

	"pgregory.net/rapid"
)

func TestPhMakeIsSlugOrEmpty(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		got := Make(s)
		if got != "" && !IsSlug(got) {
			t.Fatalf("Make(%q)=%q not slug", s, got)
		}
	})
}

func TestPhMakeMaxLength(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[a-z0-9_ -]{0,30}`).Draw(t, "s")
		MaxLength = rapid.IntRange(1, 10).Draw(t, "m")
		defer func() { MaxLength = 0 }()
		got := Make(s)
		if len(got) > MaxLength {
			t.Fatalf("too long %q", got)
		}
		if got != "" && !IsSlug(got) {
			t.Fatalf("Make(%q) max=%d =%q not slug", s, MaxLength, got)
		}
	})
}

func TestPhNonSmartDefaultMax(t *testing.T) {
	EnableSmartTruncate = false
	defer func() { EnableSmartTruncate = true }()
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[a-z]{1,10}`).Draw(t, "s")
		if got := Make(s); got != s {
			t.Fatalf("Make(%q)=%q", s, got)
		}
	})
}

func TestPhIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		a := Make(s)
		if b := Make(a); a != b {
			t.Fatalf("%q -> %q -> %q", s, a, b)
		}
	})
}

func TestPhSubstituteRuneIdentity(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		if SubstituteRune(s, nil) != s || Substitute(s, nil) != s {
			t.Fatal("identity")
		}
	})
}
