package cast

import (
	"encoding/json"
	"strconv"
	"testing"
	"time"

	"pgregory.net/rapid"
)

func TestPhDurationString(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		d := time.Duration(rapid.Int64().Draw(t, "d"))
		got, err := ToDurationE(d.String())
		if err != nil || got != d {
			t.Fatalf("%q -> %v %v", d.String(), got, err)
		}
	})
}

func TestPhDurationInt(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64().Draw(t, "n")
		got, err := ToDurationE(n)
		if err != nil || got != time.Duration(n) {
			t.Fatalf("%d -> %v %v", n, got, err)
		}
		got, err = ToDurationE(strconv.FormatInt(n, 10))
		if err != nil || got != time.Duration(n) {
			t.Fatalf("str %d -> %v %v", n, got, err)
		}
	})
}

func TestPhTimeRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		sec := rapid.Int64Range(0, 253402300799).Draw(t, "s")
		tm := time.Unix(sec, 0).UTC()
		for _, f := range []string{time.RFC3339, time.RFC1123Z, time.RubyDate, "2006-01-02 15:04:05 -0700", "2006-01-02 15:04:05.999999999 -0700 MST", "2006-01-02T15:04:05", "2006-01-02 15:04:05", time.ANSIC} {
			got, err := StringToDate(tm.Format(f))
			if err != nil || !got.Equal(tm) {
				t.Fatalf("%s: %q -> %v %v want %v", f, tm.Format(f), got, err, tm)
			}
		}
	})
}

func TestPhLocation(t *testing.T) {
	loc := time.FixedZone("X", 3*3600+1800)
	rapid.Check(t, func(t *rapid.T) {
		sec := rapid.Int64Range(0, 4102444800).Draw(t, "s")
		tm := time.Unix(sec, 0).UTC()
		s := tm.Format("2006-01-02 15:04:05")
		got, err := StringToDateInDefaultLocation(s, loc)
		want, _ := time.ParseInLocation("2006-01-02 15:04:05", s, loc)
		if err != nil || !got.Equal(want) {
			t.Fatalf("%q %v %v", s, got, err)
		}
		s2 := tm.Format(time.RFC1123)
		got, err = StringToDateInDefaultLocation(s2, loc)
		if err != nil || got.Location() != loc || got.Format("2006-01-02 15:04:05") != s {
			t.Fatalf("%q %v %v", s2, got, err)
		}
	})
}

func TestPhToTimeInts(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64Range(-1<<40, 1<<40).Draw(t, "n")
		a, _ := ToTimeE(n)
		c, err := ToTimeE(json.Number(strconv.FormatInt(n, 10) + ".0"))
		if err != nil || !a.Equal(c) {
			t.Fatalf("%v %v %v", a, c, err)
		}
		if n >= 0 {
			d, err := ToTimeE(uint64(n))
			if err != nil || !a.Equal(d) {
				t.Fatal(d, err)
			}
		}
	})
}
