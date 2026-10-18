package version

import (
	"fmt"
	"strings"
	"testing"

	"pgregory.net/rapid"
)

var phOps = []string{"", "=", "!=", ">", "<", ">=", "<=", "~>"}

func phVer(t *rapid.T, name string) string {
	n := rapid.IntRange(1, 4).Draw(t, name+"n")
	s := ""
	for i := 0; i < n; i++ {
		if i > 0 {
			s += "."
		}
		s += fmt.Sprint(rapid.IntRange(0, 4).Draw(t, fmt.Sprintf("%s%d", name, i)))
	}
	return s
}

func phCons(t *rapid.T, name string) string {
	n := rapid.IntRange(1, 3).Draw(t, name+"cnt")
	s := ""
	for i := 0; i < n; i++ {
		if i > 0 {
			s += ","
		}
		s += rapid.SampledFrom(phOps).Draw(t, name+"op") + rapid.SampledFrom([]string{"", " "}).Draw(t, name+"sp") + phVer(t, fmt.Sprintf("%sv%d", name, i))
	}
	return s
}

func TestPhEqualsReflexiveAndPermutation(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phCons(t, "a")
		cs, err := NewConstraint(s)
		if err != nil {
			t.Fatal(err)
		}
		if !cs.Equals(cs) {
			t.Fatalf("not reflexive %q", s)
		}
		rev := make(Constraints, len(cs))
		for i := range cs {
			rev[len(cs)-1-i] = cs[i]
		}
		if !cs.Equals(rev) || !rev.Equals(cs) {
			t.Fatalf("not order-insensitive %q", s)
		}
	})
}

func TestPhEqualsSymmetricAndImplicitEq(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, _ := NewConstraint(phCons(t, "a"))
		b, _ := NewConstraint(phCons(t, "b"))
		if a.Equals(b) != b.Equals(a) {
			t.Fatalf("asymmetric %q %q", a, b)
		}
		v := phVer(t, "v")
		x := MustConstraints(NewConstraint("=" + v))
		y := MustConstraints(NewConstraint(" " + v))
		if !x.Equals(y) {
			t.Fatal("= vs missing")
		}
	})
}

func TestPhEqualsImpliesSameCheck(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, _ := NewConstraint(phCons(t, "a"))
		b, _ := NewConstraint(phCons(t, "b"))
		v, _ := NewVersion(phVer(t, "x"))
		if a.Equals(b) && a.Check(v) != b.Check(v) {
			t.Fatalf("%q %q differ on %s", a, b, v)
		}
	})
}

func TestPhCheckIsAnd(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		cs, _ := NewConstraint(phCons(t, "a"))
		v, _ := NewVersion(phVer(t, "x"))
		want := true
		for _, c := range cs {
			want = want && c.Check(v)
		}
		if cs.Check(v) != want {
			t.Fatal("and")
		}
	})
}

func TestPhOperatorsReference(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		cv, _ := NewVersion(phVer(t, "c"))
		v, _ := NewVersion(phVer(t, "x"))
		cmp := v.Compare(cv)
		for op, want := range map[string]bool{"=": cmp == 0, "!=": cmp != 0, ">": cmp > 0, "<": cmp < 0, ">=": cmp >= 0, "<=": cmp <= 0} {
			c := MustConstraints(NewConstraint(op + cv.Original()))
			if c.Check(v) != want {
				t.Fatalf("%s%s on %s", op, cv.Original(), v.Original())
			}
		}
	})
}

func TestPhPessimistic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		cs := phVer(t, "c")
		cv, _ := NewVersion(cs)
		v, _ := NewVersion(phVer(t, "x"))
		n := len(strings.Split(cs, "."))
		if n < 2 || len(strings.Split(v.Original(), ".")) < n {
			t.Skip()
		}
		want := v.Compare(cv) >= 0
		for i := 0; i < n-1; i++ {
			if v.Segments()[i] != cv.Segments()[i] {
				want = false
			}
		}
		got := MustConstraints(NewConstraint("~>" + cs)).Check(v)
		if got != want {
			t.Fatalf("~>%s on %s got %v", cs, v.Original(), got)
		}
	})
}

func TestPhParseStringRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phCons(t, "a")
		cs, err := NewConstraint(s)
		if err != nil {
			t.Fatal(err)
		}
		cs2, err := NewConstraint(cs.String())
		if err != nil || !cs.Equals(cs2) {
			t.Fatalf("roundtrip %q", s)
		}
	})
}

func TestPhNewConstraintNoCrash(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		cs, err := NewConstraint(s)
		if err == nil && len(cs) == 0 {
			t.Fatal("empty")
		}
	})
}

func TestPhMustPanics(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phCons(t, "a")
		cs, _ := NewConstraint(s)
		if len(MustConstraints(cs, nil)) != len(cs) {
			t.Fatal("must")
		}
		defer func() {
			if recover() == nil {
				t.Fatal("no panic")
			}
		}()
		MustConstraints(nil, fmt.Errorf("x"))
	})
}
