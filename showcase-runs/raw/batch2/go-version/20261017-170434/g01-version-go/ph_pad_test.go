package version

import (
	"testing"

	"pgregory.net/rapid"
)

func TestPhZeroPadPrerelease(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		base := rapid.StringMatching(`[0-9]\.[0-9]\.[0-9]`).Draw(t, "base")
		pre := rapid.SampledFrom([]string{"", "-alpha", "-1", "-rc.1"}).Draw(t, "pre")
		a := Must(NewVersion(base + pre))
		b := Must(NewVersion(base + ".0" + pre))
		if a.Compare(b) != 0 {
			t.Fatalf("%q vs %q: %d", a, b, a.Compare(b))
		}
		c := Must(NewVersion(base))
		if (a.Compare(c) == 0) != (b.Compare(c) == 0) {
			t.Fatalf("%q %q vs %q: %d %d", a, b, c, a.Compare(c), b.Compare(c))
		}
	})
}
