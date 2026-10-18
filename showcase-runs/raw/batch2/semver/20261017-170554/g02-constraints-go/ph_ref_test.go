package semver

import (
	"fmt"
	"testing"

	"pgregory.net/rapid"
)

func phFull() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		return fmt.Sprintf("%d.%d.%d", rapid.IntRange(0, 3).Draw(t, "a"), rapid.IntRange(0, 3).Draw(t, "b"), rapid.IntRange(0, 3).Draw(t, "c"))
	})
}

func TestPhReferenceOps(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		op := rapid.SampledFrom([]string{"", "=", "!=", ">", "<", ">=", "<=", "~", "^"}).Draw(t, "op")
		cv := phFull().Draw(t, "cv")
		vs := phFull().Draw(t, "v")
		c, err := NewConstraint(op + cv)
		if err != nil {
			t.Fatal(err)
		}
		v, _ := NewVersion(vs)
		k, _ := NewVersion(cv)
		cmp := v.Compare(k)
		var want bool
		switch op {
		case "", "=":
			want = cmp == 0
		case "!=":
			want = cmp != 0
		case ">":
			want = cmp > 0
		case "<":
			want = cmp < 0
		case ">=":
			want = cmp >= 0
		case "<=":
			want = cmp <= 0
		case "~":
			want = cmp >= 0 && v.Major() == k.Major() && v.Minor() == k.Minor()
		case "^":
			if cmp < 0 {
				want = false
			} else if k.Major() > 0 {
				want = v.Major() == k.Major()
			} else if k.Minor() > 0 {
				want = v.Major() == 0 && v.Minor() == k.Minor()
			} else {
				want = v.Major() == 0 && v.Minor() == 0 && v.Patch() == k.Patch()
			}
		}
		if got := c.Check(v); got != want {
			t.Fatalf("%q on %s: got %v want %v", op+cv, vs, got, want)
		}
	})
}

func TestPhRange(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := phFull().Draw(t, "a")
		b := phFull().Draw(t, "b")
		vs := phFull().Draw(t, "v")
		c, err := NewConstraint(a + " - " + b)
		if err != nil {
			t.Fatal(err)
		}
		v, _ := NewVersion(vs)
		lo, _ := NewVersion(a)
		hi, _ := NewVersion(b)
		want := v.Compare(lo) >= 0 && v.Compare(hi) <= 0
		if c.Check(v) != want {
			t.Fatalf("%s - %s on %s: want %v", a, b, vs, want)
		}
		var c2 Constraints
		if err := c2.UnmarshalText([]byte(c.String())); err != nil {
			t.Fatal(err)
		}
		if c2.Check(v) != want {
			t.Fatalf("reparsed %q differs", c.String())
		}
	})
}

func TestPhPartialWildcards(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		maj := uint64(rapid.IntRange(0, 3).Draw(t, "maj"))
		min := uint64(rapid.IntRange(0, 3).Draw(t, "min"))
		vs := phFull().Draw(t, "v")
		v, _ := NewVersion(vs)
		cases := []struct {
			s    string
			want bool
		}{
			{fmt.Sprintf(">%d", maj), v.Major() > maj},
			{fmt.Sprintf(">=%d", maj), v.Major() >= maj},
			{fmt.Sprintf("<%d", maj), v.Major() < maj},
			{fmt.Sprintf("<=%d", maj), v.Major() <= maj},
			{fmt.Sprintf("!=%d", maj), v.Major() != maj},
			{fmt.Sprintf("%d.x", maj), v.Major() == maj},
			{fmt.Sprintf(">%d.%d", maj, min), v.Major() > maj || (v.Major() == maj && v.Minor() > min)},
			{fmt.Sprintf("<=%d.%d", maj, min), v.Major() < maj || (v.Major() == maj && v.Minor() <= min)},
			{fmt.Sprintf("<%d.%d", maj, min), v.Major() < maj || (v.Major() == maj && v.Minor() < min)},
			{fmt.Sprintf("!=%d.%d.x", maj, min), !(v.Major() == maj && v.Minor() == min)},
			{fmt.Sprintf("!=%d.x", maj), v.Major() != maj},
		}
		for _, cs := range cases {
			c, err := NewConstraint(cs.s)
			if err != nil {
				t.Fatal(err)
			}
			if c.Check(v) != cs.want {
				t.Fatalf("%q on %s: got %v want %v", cs.s, vs, !cs.want, cs.want)
			}
		}
	})
}
