package semver

import (
	"fmt"
	"testing"

	"pgregory.net/rapid"
)

func phVer() *rapid.Generator[string] {
	return rapid.StringMatching(`(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})(-(0|[1-9][0-9]{0,3}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]{0,3}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?`)
}

func TestPhRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phVer().Draw(t, "s")
		v, err := Parse(s)
		if err != nil {
			t.Fatalf("%q: %v", s, err)
		}
		if v.String() != s {
			t.Fatalf("%q -> %q", s, v.String())
		}
		if MustParse(s).String() != s {
			t.Fatal("must")
		}
		f, err := FinalizeVersion(s)
		if err != nil || f != fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch) {
			t.Fatalf("fin %q %v", f, err)
		}
	})
}

func TestPhTolerant(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phVer().Draw(t, "s")
		pad := rapid.SampledFrom([]string{"", "v", " v", "  "}).Draw(t, "pad")
		want, _ := Parse(s)
		got, err := ParseTolerant(pad + s + " ")
		if err != nil {
			t.Fatalf("%q: %v", pad+s, err)
		}
		if got.String() != want.String() {
			t.Fatalf("%q", s)
		}
	})
}

func TestPhTolerantZeros(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := rapid.IntRange(0, 999).Draw(t, "a")
		b := rapid.IntRange(0, 999).Draw(t, "b")
		c := rapid.IntRange(0, 999).Draw(t, "c")
		z := rapid.SampledFrom([]string{"", "0", "00"}).Draw(t, "z")
		suf := rapid.SampledFrom([]string{"", "-alpha", "+b1", "-0", "-rc.1+x"}).Draw(t, "suf")
		s := fmt.Sprintf("%s%d.%s%d.%s%d%s", z, a, z, b, z, c, suf)
		got, err := ParseTolerant(s)
		if err != nil {
			t.Fatalf("%q: %v", s, err)
		}
		want := fmt.Sprintf("%d.%d.%d%s", a, b, c, suf)
		if got.String() != want {
			t.Fatalf("%q -> %q want %q", s, got.String(), want)
		}
	})
}

func TestPhTolerantShort(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := rapid.IntRange(0, 999).Draw(t, "a")
		b := rapid.IntRange(0, 999).Draw(t, "b")
		for _, s := range []string{fmt.Sprint(a), fmt.Sprintf("%d.%d", a, b)} {
			if _, err := ParseTolerant(s); err != nil {
				t.Fatalf("%q %v", s, err)
			}
		}
	})
}

func TestPhTolerantInvalid(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[v ]{0,3}`).Draw(t, "s")
		if v, err := ParseTolerant(s); err == nil {
			t.Fatalf("%q accepted as %v", s, v)
		}
	})
}

func TestPhPRBuild(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		p, err := NewPRVersion(s)
		if err == nil && p.String() != s {
			t.Fatalf("pr %q", s)
		}
		b, berr := NewBuildVersion(s)
		if berr == nil && b != s {
			t.Fatalf("b")
		}
	})
}

func TestPhParseNoPanic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[0-9a-z.+\-v ]{0,20}`).Draw(t, "s")
		ParseTolerant(s)
		Parse(s)
		FinalizeVersion(s)
	})
}
