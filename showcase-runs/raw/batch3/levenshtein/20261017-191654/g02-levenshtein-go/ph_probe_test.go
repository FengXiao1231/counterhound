package levenshtein

import "testing"

func TestPhProbe(t *testing.T) {
	a, b := []rune("aaa"), []rune("bbbab")
	for mx := 0; mx <= 8; mx++ {
		d, _, _ := Calculate(a, b, mx, 1, 2, 2)
		t.Logf("max=%d dist=%d", mx, d)
	}
	t.Fail()
}
