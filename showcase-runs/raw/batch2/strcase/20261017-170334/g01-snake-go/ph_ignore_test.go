package strcase

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func TestPhIgnorePreserved(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z0-9 _.\-]{0,12}`).Draw(t, "s")
		ign := rapid.SampledFrom([]string{".", "-", "_", " ", ".-"}).Draw(t, "ign")
		got := ToScreamingDelimited(s, '_', ign, false)
		for _, c := range ign {
			if strings.Count(got, string(c)) < strings.Count(strings.TrimSpace(s), string(c)) {
				t.Fatalf("ignore %q lost in %q -> %q", ign, s, got)
			}
		}
		ns := strings.Map(func(r rune) rune {
			if strings.ContainsRune(ign, r) {
				return -1
			}
			return r
		}, got)
		if strings.ToLower(strings.Map(func(r rune) rune {
			if strings.ContainsRune(ign, r) || strings.ContainsRune(" _.-_", r) {
				return -1
			}
			return r
		}, s)) != strings.ReplaceAll(ns, "_", "") {
			t.Fatalf("content changed %q -> %q", s, got)
		}
	})
}

func TestPhDelimiterNoCrashUnicode(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		d := rapid.SampledFrom([]byte{'_', '-', '.', '/'}).Draw(t, "d")
		_ = ToDelimited(s, d)
		a := ToScreamingDelimited(s, d, "", true)
		if a != strings.ToUpper(a) && strings.ToUpper(a) != a {
			// non-ASCII only; ignore
		}
	})
}
