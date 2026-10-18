package wordwrap

import (
	"strings"
	"testing"
	"unicode"

	"pgregory.net/rapid"
)

func phStripSpace(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) && r != nbsp {
			return -1
		}
		return r
	}, s)
}

func phText() *rapid.Generator[string] {
	return rapid.StringMatching(`[a-z \n\t]{0,60}`)
}

func TestPhNoContentLoss(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		lim := rapid.UintRange(0, 20).Draw(t, "lim")
		got := WrapString(s, lim)
		if phStripSpace(got) != phStripSpace(s) {
			t.Fatalf("%q lim %d -> %q", s, lim, got)
		}
	})
}

func TestPhLineWidth(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phText().Draw(t, "s")
		lim := rapid.UintRange(1, 12).Draw(t, "lim")
		got := WrapString(s, lim)
		for _, line := range strings.Split(got, "\n") {
			words := strings.Fields(line)
			if len(words) > 1 && uint(len([]rune(strings.TrimRight(line, " \t")))) > lim {
				t.Fatalf("%q lim %d -> %q line %q", s, lim, got, line)
			}
		}
	})
}

func TestPhNoNewBreaksInShort(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phText().Draw(t, "s")
		lim := uint(len([]rune(s)))
		if got := WrapString(s, lim); got != s {
			t.Fatalf("%q lim %d -> %q", s, lim, got)
		}
	})
}

func TestPhIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[a-z ]{0,60}`).Draw(t, "s")
		lim := rapid.UintRange(1, 12).Draw(t, "lim")
		a := WrapString(s, lim)
		b := WrapString(a, lim)
		if a != b {
			t.Fatalf("%q lim %d -> %q -> %q", s, lim, a, b)
		}
	})
}
