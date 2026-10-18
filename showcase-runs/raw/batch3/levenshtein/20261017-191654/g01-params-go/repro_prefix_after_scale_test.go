package levenshtein

import "testing"

func TestReproPrefixAfterScale(t *testing.T) {
	p := NewParams().BonusScale(0.25).BonusPrefix(10)
	s := Match("aaaaaaaaaaaaaaaaaaab", "aaaaaaaaaaaaaaaaaaac", p)
	if s > 1 {
		t.Fatalf("Match = %v, want <= 1", s)
	}
}
