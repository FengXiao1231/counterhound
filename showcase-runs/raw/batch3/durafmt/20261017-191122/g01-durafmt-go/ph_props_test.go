package durafmt

import (
	"strings"
	"testing"
	"time"

	"pgregory.net/rapid"
)

func phDur() *rapid.Generator[time.Duration] {
	return rapid.Custom(func(t *rapid.T) time.Duration {
		return time.Duration(rapid.Int64Range(-1<<62, 1<<62).Draw(t, "d"))
	})
}

func TestPhFormatIdempotent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		d := Parse(phDur().Draw(t, "d"))
		a := d.String()
		b := d.String()
		if a != b {
			t.Fatalf("first %q second %q", a, b)
		}
	})
}

func TestPhDurationUnchanged(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		x := phDur().Draw(t, "d")
		d := Parse(x)
		d.String()
		if d.Duration() != x {
			t.Fatalf("Duration() %v != %v", d.Duration(), x)
		}
	})
}

func TestPhLimitFirstN(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		x := phDur().Draw(t, "d")
		a := ParseShort(x).String()
		b := Parse(x).LimitFirstN(1).String()
		if a != b {
			t.Fatalf("%q vs %q", a, b)
		}
	})
}

func TestPhParseStringAgrees(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		x := phDur().Draw(t, "d")
		if x == 0 {
			t.Skip()
		}
		p, err := ParseString(x.String())
		if err != nil {
			t.Fatal(err)
		}
		if p.Duration() != x {
			t.Fatal("dur mismatch")
		}
		if p.String() != Parse(x).String() {
			t.Fatalf("%q vs %q", p.String(), Parse(x).String())
		}
		s, _ := ParseStringShort(x.String())
		if s.String() != ParseShort(x).String() {
			t.Fatal("short mismatch")
		}
	})
}

func TestPhLimitUnit(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		x := time.Duration(rapid.Int64Range(1, 1<<62).Draw(t, "d"))
		got := Parse(x).LimitToUnit("hours").String()
		for _, bad := range []string{"year", "week", "day"} {
			if strings.Contains(got, bad) {
				t.Fatalf("%q has %s", got, bad)
			}
		}
	})
}
