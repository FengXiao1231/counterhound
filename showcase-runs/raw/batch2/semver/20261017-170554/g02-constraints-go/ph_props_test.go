package semver

import (
	"fmt"
	"testing"

	"pgregory.net/rapid"
)

func phPart() *rapid.Generator[string] {
	return rapid.SampledFrom([]string{"0", "1", "2", "3", "x", "*", "X"})
}

func phCons() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		ops := []string{"", "=", "!=", ">", "<", ">=", "=>", "<=", "=<", "~", "~>", "^"}
		op := rapid.SampledFrom(ops).Draw(t, "op")
		n := rapid.IntRange(1, 3).Draw(t, "n")
		v := rapid.SampledFrom([]string{"", "v"}).Draw(t, "v")
		for i := 0; i < n; i++ {
			if i > 0 {
				v += "."
			}
			v += phPart().Draw(t, "p")
		}
		if rapid.Bool().Draw(t, "pre") {
			v += "-" + rapid.SampledFrom([]string{"alpha", "beta.1", "rc"}).Draw(t, "pr")
		}
		sp := rapid.SampledFrom([]string{"", " "}).Draw(t, "sp")
		return op + sp + v
	})
}

func phCS() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		ors := rapid.IntRange(1, 3).Draw(t, "ors")
		s := ""
		for i := 0; i < ors; i++ {
			if i > 0 {
				s += " || "
			}
			ands := rapid.IntRange(1, 3).Draw(t, "ands")
			for j := 0; j < ands; j++ {
				if j > 0 {
					s += rapid.SampledFrom([]string{" ", ", "}).Draw(t, "sep")
				}
				s += phCons().Draw(t, "c")
			}
		}
		return s
	})
}

func phVer() *rapid.Generator[*Version] {
	return rapid.Custom(func(t *rapid.T) *Version {
		s := fmt.Sprintf("%d.%d.%d", rapid.IntRange(0, 4).Draw(t, "a"), rapid.IntRange(0, 4).Draw(t, "b"), rapid.IntRange(0, 4).Draw(t, "c"))
		if rapid.Bool().Draw(t, "pre") {
			s += "-" + rapid.SampledFrom([]string{"alpha", "beta.1", "rc"}).Draw(t, "pr")
		}
		v, err := NewVersion(s)
		if err != nil {
			t.Fatal(err)
		}
		return v
	})
}

func TestPhCheckValidate(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phCS().Draw(t, "s")
		c, err := NewConstraint(s)
		if err != nil {
			t.Skip()
		}
		for _, inc := range []bool{false, true} {
			c.IncludePrerelease = inc
			v := phVer().Draw(t, "v")
			ok, errs := c.Validate(v)
			if ok != c.Check(v) {
				t.Fatalf("%q inc=%v v=%v Validate=%v Check=%v", s, inc, v, ok, c.Check(v))
			}
			if !ok && len(errs) == 0 {
				t.Fatalf("%q v=%v failed without reasons", s, v)
			}
			if ok && len(errs) != 0 {
				t.Fatalf("ok with errors")
			}
		}
	})
}

func TestPhStringRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phCS().Draw(t, "s")
		c, err := NewConstraint(s)
		if err != nil {
			t.Skip()
		}
		txt, _ := c.MarshalText()
		var c2 Constraints
		if err := c2.UnmarshalText(txt); err != nil {
			t.Fatalf("%q -> %q reparse: %v", s, txt, err)
		}
		if c2.String() != c.String() {
			t.Fatalf("%q: %q != %q", s, c.String(), c2.String())
		}
		for i := 0; i < 5; i++ {
			v := phVer().Draw(t, "v")
			if c.Check(v) != c2.Check(v) {
				t.Fatalf("%q -> %q differ on %v", s, txt, v)
			}
		}
	})
}

func TestPhOrUnion(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := phCS().Draw(t, "a")
		b := phCS().Draw(t, "b")
		ca, e1 := NewConstraint(a)
		cb, e2 := NewConstraint(b)
		cu, e3 := NewConstraint(a + " || " + b)
		if e1 != nil || e2 != nil {
			t.Skip()
		}
		if e3 != nil {
			t.Fatalf("union failed: %v", e3)
		}
		v := phVer().Draw(t, "v")
		if cu.Check(v) != (ca.Check(v) || cb.Check(v)) {
			t.Fatalf("%q || %q on %v", a, b, v)
		}
	})
}
