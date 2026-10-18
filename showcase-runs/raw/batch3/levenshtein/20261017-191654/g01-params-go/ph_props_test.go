package levenshtein

import (
	"testing"

	"pgregory.net/rapid"
)

func TestPhMatchRange(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		sc := rapid.Float64Range(0, 1).Draw(t, "sc")
		pr := rapid.IntRange(0, 50).Draw(t, "pr")
		s1 := rapid.StringMatching("a{0,30}[bc]?").Draw(t, "s1")
		s2 := rapid.StringMatching("a{0,30}[bc]?").Draw(t, "s2")
		p := NewParams().BonusScale(sc).BonusPrefix(pr)
		if m := Match(s1, s2, p); m < 0 || m > 1 {
			t.Fatalf("Match=%v sc=%v pr=%v", m, sc, pr)
		}
	})
}
