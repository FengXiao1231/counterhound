package levenshtein

import (
	"math"
	"testing"
)

func TestReproZeroCostNaN(t *testing.T) {
	p := NewParams().InsCost(0)
	for _, v := range []float64{Similarity("", "a", p), Match("", "a", p)} {
		if math.IsNaN(v) || v < 0 || v > 1 {
			t.Fatalf("score for \"\" vs \"a\" with InsCost(0) = %v, want within 0..1", v)
		}
	}
}
