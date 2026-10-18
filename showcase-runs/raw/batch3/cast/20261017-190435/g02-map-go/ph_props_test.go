package cast

import (
	"testing"

	"pgregory.net/rapid"
)

func TestPhIntNonStringKeys(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		m := rapid.MapOf(rapid.Int(), rapid.IntRange(-100, 100)).Draw(t, "m")
		got, err := ToStringMapIntE(m)
		if err == nil && len(got) != len(m) {
			t.Fatalf("len mismatch %v %v", got, m)
		}
	})
}

func TestPhInt64NonStringKeys(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		m := rapid.MapOf(rapid.Int(), rapid.Int64Range(-100, 100)).Draw(t, "m")
		got, err := ToStringMapInt64E(m)
		if err == nil && len(got) != len(m) {
			t.Fatalf("len mismatch %v %v", got, m)
		}
	})
}

func TestPhStringMapStringAny(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		m := rapid.MapOf(rapid.String(), rapid.String()).Draw(t, "m")
		a := map[string]any{}
		for k, v := range m {
			a[k] = v
		}
		got, err := ToStringMapStringE(a)
		if err != nil || len(got) != len(m) {
			t.Fatal(err)
		}
		for k, v := range m {
			if got[k] != v {
				t.Fatal("mismatch")
			}
		}
	})
}

func TestPhSliceAnyStringVal(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		m := rapid.MapOf(rapid.String(), rapid.String()).Draw(t, "m")
		a := map[any]string{}
		b := map[string]string{}
		for k, v := range m {
			a[k] = v
			b[k] = v
		}
		g1, _ := ToStringMapStringSliceE(a)
		g2, _ := ToStringMapStringSliceE(b)
		for k := range m {
			if len(g1[k]) != len(g2[k]) || (len(g1[k]) > 0 && g1[k][0] != g2[k][0]) {
				t.Fatalf("%q: %q vs %q", k, g1[k], g2[k])
			}
		}
	})
}
