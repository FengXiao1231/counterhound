package durafmt

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func phUnit(t *rapid.T, name string) Unit {
	g := rapid.StringMatching(`[a-zê ]{0,6}`)
	return Unit{g.Draw(t, name+"s"), g.Draw(t, name+"p")}
}

func phUnits(t *rapid.T) Units {
	return Units{phUnit(t, "y"), phUnit(t, "w"), phUnit(t, "d"), phUnit(t, "h"),
		phUnit(t, "m"), phUnit(t, "s"), phUnit(t, "ms"), phUnit(t, "us")}
}

func TestPhRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		c := UnitsCoder{rapid.SampledFrom([]string{":", "|", "=>"}).Draw(t, "ps"), rapid.SampledFrom([]string{",", ";", "//"}).Draw(t, "us")}
		u := phUnits(t)
		got, err := c.Decode(c.Encode(u))
		if err != nil || got != u {
			t.Fatalf("%v %+v %+v", err, u, got)
		}
	})
}

func TestPhSingularOnly(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		names := rapid.SliceOfN(rapid.StringMatching(`[a-z]{1,5}`), 8, 8).Draw(t, "n")
		got, err := DefaultUnitsCoder.Decode(strings.Join(names, ","))
		if err != nil {
			t.Fatal(err)
		}
		for i, u := range got.Units() {
			if u.Singular != names[i] || u.Plural != names[i]+"s" {
				t.Fatalf("%d %+v", i, u)
			}
		}
	})
}

func TestPhDecodeNoPanic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		_, _ = DefaultUnitsCoder.Decode(s)
	})
}

func TestPhUnitsOrder(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		u := phUnits(t)
		l := u.Units()
		if len(l) != 8 || l[0] != u.Year || l[7] != u.Microsecond || l[4] != u.Minute {
			t.Fatal("bad")
		}
	})
}
