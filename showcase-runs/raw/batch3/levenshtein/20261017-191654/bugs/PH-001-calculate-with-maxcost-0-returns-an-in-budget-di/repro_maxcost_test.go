package levenshtein

import "testing"

// Exact distance "aaa"->"bbbab" with ins=1, sub=2, del=2 is 6.
// With maxCost=2, Calculate must return a value > 2 (a lower bound), not 2.
func TestReproMaxCostFalseWithinBudget(t *testing.T) {
	d, _, _ := Calculate([]rune("aaa"), []rune("bbbab"), 2, 1, 2, 2)
	if d <= 2 {
		t.Fatalf("Calculate with maxCost=2 returned %d, but actual distance is 6 (> maxCost)", d)
	}
	if got := Similarity("aaa", "bbbab", NewParams().InsCost(1).SubCost(2).DelCost(2).MinScore(0.75)); got != 0 {
		t.Fatalf("Similarity with MinScore=0.75 = %v, want 0 (true score 0.25)", got)
	}
}
