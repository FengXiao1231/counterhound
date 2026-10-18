package runewidth

import "testing"

func TestPhIsEastAsianStable(t *testing.T) {
	a := IsEastAsian()
	for i := 0; i < 10; i++ {
		if IsEastAsian() != a {
			t.Fatalf("IsEastAsian not deterministic")
		}
	}
}
