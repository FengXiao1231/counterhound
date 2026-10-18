package version

import (
	"testing"

	"pgregory.net/rapid"
)

func phVer() *rapid.Generator[string] {
	return rapid.StringMatching(`v?[0-9]{1,3}(\.[0-9]{1,3}){0,4}(-[0-9A-Za-z\-]{1,4}(\.[0-9A-Za-z\-]{1,4}){0,2})?(\+[0-9A-Za-z\-]{1,4}(\.[0-9A-Za-z\-]{1,3}){0,2})?`)
}

func TestPhRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phVer().Draw(t, "s")
		v, err := NewVersion(s)
		if err != nil {
			t.Skip()
		}
		b, _ := v.MarshalText()
		var w Version
		if err := w.UnmarshalText(b); err != nil {
			t.Fatalf("%q -> %q: %v", s, b, err)
		}
		if w.String() != v.String() || w.Compare(v) != 0 {
			t.Fatalf("%q -> %q vs %q", s, v, &w)
		}
		if w.Prerelease() != v.Prerelease() || w.Metadata() != v.Metadata() {
			t.Fatalf("parts differ %q", s)
		}
	})
}

func TestPhCompareAntisym(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, err := NewVersion(phVer().Draw(t, "a"))
		if err != nil {
			t.Skip()
		}
		b, err := NewVersion(phVer().Draw(t, "b"))
		if err != nil {
			t.Skip()
		}
		if a.Compare(b) != -b.Compare(a) {
			t.Fatalf("%q %q: %d %d", a, b, a.Compare(b), b.Compare(a))
		}
	})
}

func TestPhCompareTrans(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		var vs [3]*Version
		for i := range vs {
			v, err := NewVersion(phVer().Draw(t, "v"))
			if err != nil {
				t.Skip()
			}
			vs[i] = v
		}
		a, b, c := vs[0], vs[1], vs[2]
		if a.Compare(b) <= 0 && b.Compare(c) <= 0 && a.Compare(c) > 0 {
			t.Fatalf("%q <= %q <= %q but a>c", a, b, c)
		}
		if a.Compare(b) == 0 && b.Compare(c) == 0 && a.Compare(c) != 0 {
			t.Fatalf("eq not transitive %q %q %q", a, b, c)
		}
	})
}

func TestPhPrefix(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		p := rapid.StringMatching(`[a-z_]{1,4}`).Draw(t, "p")
		s := rapid.StringMatching(`[0-9]{1,3}(\.[0-9]{1,3}){0,3}`).Draw(t, "s")
		v, err := NewVersion(p+s, WithPrefix(p))
		if err != nil {
			t.Fatal(err)
		}
		w, _ := NewVersion(s)
		if v.Compare(w) != 0 || v.Original() != p+s || v.Prefix() != p {
			t.Fatalf("%q %q", p, s)
		}
	})
}

func TestPhSemverSubset(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phVer().Draw(t, "s")
		sv, err := NewSemver(s)
		if err != nil {
			t.Skip()
		}
		v, err := NewVersion(s)
		if err != nil {
			t.Fatalf("semver ok but version fails %q", s)
		}
		if sv.String() != v.String() {
			t.Fatalf("%q", s)
		}
	})
}
