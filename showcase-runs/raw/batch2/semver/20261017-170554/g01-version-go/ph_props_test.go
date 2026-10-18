package semver

import (
	"encoding/json"
	"regexp"
	"testing"

	"pgregory.net/rapid"
)

var phOfficial = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`)

func phNum() *rapid.Generator[string] {
	return rapid.StringMatching(`0|[1-9][0-9]{0,18}`)
}

func phValid() *rapid.Generator[string] {
	return rapid.StringMatching(`(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})(-(0|[1-9][0-9]{0,3}|[0-9]{0,3}[a-zA-Z-][0-9a-zA-Z-]{0,4})(\.(0|[1-9][0-9]{0,3}|[0-9]{0,3}[a-zA-Z-][0-9a-zA-Z-]{0,4})){0,3})?(\+[0-9a-zA-Z-]{1,5}(\.[0-9a-zA-Z-]{1,5}){0,3})?`)
}

func phNoisy() *rapid.Generator[string] {
	return rapid.StringMatching(`[v0-9a-zA-Z.+\-]{0,20}`)
}

func TestPhStrictValid(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phValid().Draw(t, "s")
		v, err := StrictNewVersion(s)
		if err != nil {
			t.Fatalf("%q: %v", s, err)
		}
		if v.String() != s || v.Original() != s {
			t.Fatalf("%q -> %q", s, v.String())
		}
	})
}

func TestPhStrictVsRegexMutated(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phValid().Draw(t, "s")
		if len(s) > 0 {
			i := rapid.IntRange(0, len(s)-1).Draw(t, "i")
			c := rapid.SampledFrom([]string{"", ".", "+", "-", "0", "v", "a", "_"}).Draw(t, "c")
			if rapid.Bool().Draw(t, "ins") {
				s = s[:i] + c + s[i:]
			} else {
				s = s[:i] + c + s[i+1:]
			}
		}
		_, err := StrictNewVersion(s)
		if (err == nil) != phOfficial.MatchString(s) {
			t.Fatalf("%q: err=%v regex=%v", s, err, phOfficial.MatchString(s))
		}
	})
}

func TestPhStrictVsRegex(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phNoisy().Draw(t, "s")
		v, err := StrictNewVersion(s)
		if (err == nil) != phOfficial.MatchString(s) {
			t.Fatalf("%q: err=%v regex=%v", s, err, phOfficial.MatchString(s))
		}
		if err == nil && v.String() != s {
			t.Fatalf("string %q != %q", v.String(), s)
		}
	})
}

func TestPhNewVersionAgreesStrict(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phValid().Draw(t, "s")
		a, err := StrictNewVersion(s)
		if err != nil {
			t.Fatal(err)
		}
		b, err := NewVersion(s)
		if err != nil {
			t.Fatalf("%q: %v", s, err)
		}
		if *a != *b {
			t.Fatalf("%q: %+v vs %+v", s, a, b)
		}
	})
}

func TestPhNewVersionNonCoerce(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		old := CoerceNewVersion
		CoerceNewVersion = false
		defer func() { CoerceNewVersion = old }()
		s := phNoisy().Draw(t, "s")
		_, err := NewVersion(s)
		_, err2 := StrictNewVersion(s)
		if err2 == nil && err != nil {
			t.Fatalf("%q strict ok, new fails %v", s, err)
		}
	})
}

func TestPhCoerceFields(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		maj, min, pat := phNum().Draw(t, "a"), phNum().Draw(t, "b"), phNum().Draw(t, "c")
		n := rapid.IntRange(1, 3).Draw(t, "n")
		s := maj
		if n > 1 {
			s += "." + min
		}
		if n > 2 {
			s += "." + pat
		}
		if rapid.Bool().Draw(t, "v") {
			s = "v" + s
		}
		v, err := NewVersion(s)
		if err != nil {
			t.Skip() // overflow
		}
		w, err := StrictNewVersion(maj + "." + min + "." + pat)
		if err != nil {
			t.Skip()
		}
		if v.Major() != w.Major() {
			t.Fatalf("major %q", s)
		}
		if n > 1 && v.Minor() != w.Minor() || n > 2 && v.Patch() != w.Patch() {
			t.Fatalf("%q", s)
		}
		if n < 2 && v.Minor() != 0 || n < 3 && v.Patch() != 0 {
			t.Fatalf("%q", s)
		}
	})
}

func TestPhMustParse(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phValid().Draw(t, "s")
		MustParse(s)
	})
}

func TestPhMarshalRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phValid().Draw(t, "s")
		v := MustParse(s)
		b, err := json.Marshal(v)
		if err != nil {
			t.Fatal(err)
		}
		var w Version
		if err := json.Unmarshal(b, &w); err != nil {
			t.Fatalf("%s: %v", b, err)
		}
		if w.String() != v.String() || w.Compare(v) != 0 {
			t.Fatalf("%q", s)
		}
		tx, _ := v.MarshalText()
		var u Version
		if err := u.UnmarshalText(tx); err != nil {
			t.Fatal(err)
		}
		if u != w {
			t.Fatalf("text %+v json %+v", u, w)
		}
	})
}

func TestPhUnmarshalJSONVsText(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phNoisy().Draw(t, "s")
		var a, b Version
		b1, _ := json.Marshal(s)
		e1 := a.UnmarshalJSON(b1)
		e2 := b.UnmarshalText([]byte(s))
		if (e1 == nil) != (e2 == nil) || a != b {
			t.Fatalf("%q: %v %v", s, e1, e2)
		}
	})
}
