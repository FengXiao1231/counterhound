package datasize

import (
	"math/big"
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func TestPhRoundTrip(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		b := ByteSize(rapid.Uint64().Draw(t, "b"))
		txt, _ := b.MarshalText()
		got, err := Parse(txt)
		if err != nil || got != b {
			t.Fatalf("%d -> %q -> %d, %v", b, txt, got, err)
		}
		g2, err := ParseString(string(txt))
		if err != nil || g2 != b {
			t.Fatalf("ParseString mismatch")
		}
	})
}

func TestPhReference(t *testing.T) {
	units := map[string]uint64{"": 1, "b": 1, "k": 1 << 10, "kb": 1 << 10, "m": 1 << 20, "mb": 1 << 20, "g": 1 << 30, "gb": 1 << 30,
		"t": 1 << 40, "tb": 1 << 40, "p": 1 << 50, "pb": 1 << 50, "e": 1 << 60, "eb": 1 << 60,
		"kilobyte": 1 << 10, "megabytes": 1 << 20, "terabyte": 1 << 40, "petabytes": 1 << 50, "byte": 1}
	keys := []string{}
	for k := range units {
		keys = append(keys, k)
	}
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Uint64().Draw(t, "n")
		u := rapid.SampledFrom(keys).Draw(t, "u")
		sp := rapid.SampledFrom([]string{"", " ", "\t"}).Draw(t, "sp")
		up := rapid.Bool().Draw(t, "up")
		ustr := u
		if up {
			ustr = strings.ToUpper(u)
		}
		s := big.NewInt(0).SetUint64(n).String() + sp + ustr
		want := new(big.Int).Mul(new(big.Int).SetUint64(n), new(big.Int).SetUint64(units[u]))
		got, err := ParseString(s)
		if want.IsUint64() {
			if err != nil || got.Bytes() != want.Uint64() {
				t.Fatalf("%q: got %d err %v want %v", s, got, err, want)
			}
		} else if err == nil {
			t.Fatalf("%q: expected overflow, got %d", s, got)
		}
	})
}

func TestPhNoCrash(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		v, err := ParseString(s)
		if err != nil && v != 0 && v != ByteSize(maxUint64) {
			t.Fatalf("%q: %d %v", s, v, err)
		}
	})
}
