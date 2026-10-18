package humanize

import (
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"testing"

	"pgregory.net/rapid"
)

var phUnits = []string{"b", "kb", "kib", "mb", "mib", "gb", "gib", "tb", "tib", "pb", "pib", "eb", "eib", "zb", "zib", "yb", "yib", "rb", "rib", "qb", "qib", "k", "ki", "m", "mi", "g", "gi", "t", "ti", "p", "pi", "e", "ei", "z", "zi", "y", "yi", "r", "ri", "q", "qi", ""}

func TestPhParseIntExact(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64Range(0, 1<<50).Draw(t, "n")
		u := rapid.SampledFrom(phUnits).Draw(t, "u")
		sp := rapid.SampledFrom([]string{"", " ", "  "}).Draw(t, "sp")
		up := rapid.Bool().Draw(t, "up")
		suf := u
		if up {
			suf = strings.ToUpper(u)
		}
		got, err := ParseBigBytes(fmt.Sprintf("%d%s%s", n, sp, suf))
		if err != nil {
			t.Fatalf("err %v", err)
		}
		want := new(big.Int).Mul(big.NewInt(n), bigBytesSizeTable[u])
		if got.Cmp(want) != 0 {
			t.Fatalf("got %v want %v", got, want)
		}
	})
}

func TestPhParseComma(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64Range(0, 1<<50).Draw(t, "n")
		u := rapid.SampledFrom(phUnits).Draw(t, "u")
		s := new(big.Int).Mul(big.NewInt(n), bigBytesSizeTable[u])
		str := fmt.Sprintf("%d", n)
		var parts []string
		for len(str) > 3 {
			parts = append([]string{str[len(str)-3:]}, parts...)
			str = str[:len(str)-3]
		}
		parts = append([]string{str}, parts...)
		got, err := ParseBigBytes(strings.Join(parts, ",") + " " + u)
		if err != nil {
			t.Fatal(err)
		}
		if got.Cmp(s) != 0 {
			t.Fatalf("got %v want %v", got, s)
		}
	})
}

func TestPhParseFraction(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := rapid.Int64Range(0, 100000).Draw(t, "a")
		b := rapid.Int64Range(0, 999).Draw(t, "b")
		u := rapid.SampledFrom(phUnits).Draw(t, "u")
		got, err := ParseBigBytes(fmt.Sprintf("%d.%03d %s", a, b, u))
		if err != nil {
			t.Fatal(err)
		}
		r := big.NewRat(a*1000+b, 1000)
		r.Mul(r, new(big.Rat).SetInt(bigBytesSizeTable[u]))
		want := new(big.Int).Div(r.Num(), r.Denom())
		if got.Cmp(want) != 0 {
			t.Fatalf("got %v want %v", got, want)
		}
	})
}

func TestPhParseNoPanic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		ParseBigBytes(s)
	})
}

var phFmt = regexp.MustCompile(`^(\d+ B|\d+(\.\d)? [kKMGTPEZYRQi]*B)$`)

func TestPhFormatShape(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		e := rapid.IntRange(0, 100).Draw(t, "e")
		m := rapid.Int64Range(0, 1<<40).Draw(t, "m")
		n := new(big.Int).Lsh(big.NewInt(m), uint(e))
		for _, s := range []string{BigBytes(n), BigIBytes(n)} {
			if !phFmt.MatchString(s) {
				t.Fatalf("bad shape %q for %v", s, n)
			}
		}
	})
}

func TestPhFormatRoundTripApprox(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64Range(10, 1<<62).Draw(t, "n")
		b := big.NewInt(n)
		for _, f := range []func(*big.Int) string{BigBytes, BigIBytes} {
			s := f(b)
			got, err := ParseBigBytes(s)
			if err != nil {
				t.Fatalf("%q: %v", s, err)
			}
			d := new(big.Float).SetInt(new(big.Int).Sub(got, b))
			df, _ := d.Float64()
			if df < 0 {
				df = -df
			}
			if df > float64(n)*0.1 {
				t.Fatalf("n=%d s=%q got=%v", n, s, got)
			}
		}
	})
}

func TestPhFormatValueRange(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64Range(10, 1<<62).Draw(t, "n")
		var v float64
		var u string
		s := BigBytes(big.NewInt(n))
		fmt.Sscanf(s, "%f %s", &v, &u)
		if v < 1 || v >= 1000 {
			t.Fatalf("n=%d s=%q", n, s)
		}
		s = BigIBytes(big.NewInt(n))
		fmt.Sscanf(s, "%f %s", &v, &u)
		if v < 1 || v >= 1024 {
			t.Fatalf("n=%d s=%q", n, s)
		}
	})
}

func TestPhFormatMatchesSmall(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64Range(0, 1<<62).Draw(t, "n")
		if BigBytes(big.NewInt(n)) != Bytes(uint64(n)) {
			t.Fatalf("n=%d %q vs %q", n, BigBytes(big.NewInt(n)), Bytes(uint64(n)))
		}
		if BigIBytes(big.NewInt(n)) != IBytes(uint64(n)) {
			t.Fatalf("n=%d %q vs %q", n, BigIBytes(big.NewInt(n)), IBytes(uint64(n)))
		}
	})
}

func TestPhFormatNoMutate(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.Int64Range(0, 1<<62).Draw(t, "n")
		b := big.NewInt(n)
		BigBytes(b)
		BigIBytes(b)
		if b.Int64() != n {
			t.Fatal("mutated")
		}
	})
}
