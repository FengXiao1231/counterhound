package semver

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func phVer() *rapid.Generator[string] {
	return rapid.StringMatching(`(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})(-(0|[1-9][0-9]{0,8}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]{0,8}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?`)
}

func TestPhParseRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phVer().Draw(t, "s")
		v, err := Parse(s)
		if err != nil {
			t.Fatalf("Parse(%q): %v", s, err)
		}
		if v.String() != s {
			t.Fatalf("String %q != %q", v.String(), s)
		}
		if err := v.Validate(); err != nil {
			t.Fatalf("validate %q: %v", s, err)
		}
		w := MustParse(s)
		if w.String() != s {
			t.Fatal("must")
		}
	})
}

func TestPhTolerantStrict(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phVer().Draw(t, "s")
		a, err := ParseTolerant(s)
		if err != nil {
			t.Fatalf("tolerant(%q): %v", s, err)
		}
		b, _ := Parse(s)
		if a.String() != b.String() {
			t.Fatalf("%q: %v vs %v", s, a, b)
		}
		c, err := ParseTolerant(" v" + s + "  ")
		if err != nil || c.String() != b.String() {
			t.Fatalf("prefixed %q: %v %v", s, c, err)
		}
	})
}

func TestPhTolerantZeros(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		z := rapid.StringMatching(`0{0,3}`)
		a := rapid.IntRange(0, 999).Draw(t, "a")
		b := rapid.IntRange(0, 999).Draw(t, "b")
		c := rapid.IntRange(0, 999).Draw(t, "c")
		suf := rapid.SampledFrom([]string{"", "-alpha", "-1", "+b", "-rc.1+x"}).Draw(t, "suf")
		s := z.Draw(t, "z1") + itoa(a) + "." + z.Draw(t, "z2") + itoa(b) + "." + z.Draw(t, "z3") + itoa(c) + suf
		v, err := ParseTolerant(s)
		if err != nil {
			t.Fatalf("%q: %v", s, err)
		}
		want := itoa(a) + "." + itoa(b) + "." + itoa(c) + suf
		if v.String() != want {
			t.Fatalf("%q: %q want %q", s, v.String(), want)
		}
	})
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}

func TestPhTolerantShort(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := rapid.IntRange(0, 999).Draw(t, "a")
		b := rapid.IntRange(0, 999).Draw(t, "b")
		v, err := ParseTolerant(itoa(a) + "." + itoa(b))
		if err != nil || v.String() != itoa(a)+"."+itoa(b)+".0" {
			t.Fatalf("%v %v", v, err)
		}
		v, err = ParseTolerant(itoa(a))
		if err != nil || v.String() != itoa(a)+".0.0" {
			t.Fatalf("%v %v", v, err)
		}
	})
}

func TestPhFinalize(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phVer().Draw(t, "s")
		f, err := FinalizeVersion(s)
		if err != nil {
			t.Fatal(err)
		}
		core := s
		if i := strings.IndexAny(core, "+-"); i >= 0 {
			core = core[:i]
		}
		if f != core {
			t.Fatalf("%q -> %q want %q", s, f, core)
		}
	})
}

func TestPhNewPRBuild(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[0-9A-Za-z-]{1,8}`).Draw(t, "s")
		p, err := NewPRVersion(s)
		allNum := strings.Trim(s, "0123456789") == ""
		if allNum && len(s) > 1 && s[0] == '0' {
			if err == nil {
				t.Fatal("leading zero accepted")
			}
		} else {
			if err != nil || p.String() != s || p.IsNumeric() != allNum {
				t.Fatalf("%q %v %v", s, p, err)
			}
		}
		b, err := NewBuildVersion(s)
		if err != nil || b != s {
			t.Fatalf("build %q", s)
		}
	})
}

func TestPhInvalid(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		v, err := Parse(s)
		if err == nil {
			if v.String() != s {
				t.Fatalf("accepted %q but renders %q", s, v.String())
			}
		}
		_, _ = ParseTolerant(s)
		_, _ = NewPRVersion(s)
		_, _ = NewBuildVersion(s)
	})
}
