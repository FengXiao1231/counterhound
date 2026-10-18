package humanize

import (
	"math"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"pgregory.net/rapid"
)

var phRe = regexp.MustCompile(`^(\d+)(?:\.(\d+))? (B|kB|MB|GB|TB|PB|EB|KiB|MiB|GiB|TiB|PiB|EiB)$`)

func phU64() *rapid.Generator[uint64] {
	return rapid.OneOf(rapid.Uint64(), rapid.Uint64Range(0, 5000), rapid.Custom(func(t *rapid.T) uint64 {
		e := rapid.IntRange(0, 6).Draw(t, "e")
		base := rapid.SampledFrom([]uint64{1000, 1024}).Draw(t, "b")
		v := uint64(1)
		for i := 0; i < e; i++ {
			v *= base
		}
		d := rapid.IntRange(-2, 2).Draw(t, "d")
		return uint64(int64(v) + int64(d))
	}))
}

func phExact(s uint64, base uint64, sizes []string, n int) string {
	if s < 10 {
		return strconv.FormatUint(s, 10) + " B"
	}
	return ""
}

func TestPhFormatShape(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phU64().Draw(t, "s")
		n := rapid.IntRange(0, 12).Draw(t, "n")
		for _, o := range []string{Bytes(s), IBytes(s), BytesN(s, n), IBytesN(s, n)} {
			if !phRe.MatchString(o) {
				t.Fatalf("bad shape %q for %d", o, s)
			}
		}
	})
}

func TestPhDigitCount(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phU64().Draw(t, "s")
		if s < 10 {
			t.Skip()
		}
		n := rapid.IntRange(1, 12).Draw(t, "n")
		for _, o := range []string{BytesN(s, n), IBytesN(s, n)} {
			m := phRe.FindStringSubmatch(o)
			d := len(m[1]) + len(m[2])
			ip := len(m[1])
			if m[3] == "B" {
				continue
			}
			if ip >= n && m[2] != "" {
				t.Fatalf("%q: decimals with n=%d", o, n)
			}
			if ip < n && d != n {
				t.Fatalf("%q s=%d n=%d digits=%d", o, s, n, d)
			}
			if len(m[1]) > 4 {
				t.Fatalf("%q integer part too long", o)
			}
		}
	})
}

func phBig(o string, base int64, sizes []string) *big.Float {
	m := phRe.FindStringSubmatch(o)
	v, _ := new(big.Float).SetPrec(200).SetString(m[1] + "." + m[2] + "0")
	for i, z := range sizes {
		if z == m[3] {
			for j := 0; j < i; j++ {
				v.Mul(v, big.NewFloat(float64(base)))
			}
		}
	}
	return v
}

func TestPhApproxValue(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phU64().Draw(t, "s")
		n := rapid.IntRange(2, 8).Draw(t, "n")
		si := []string{"B", "kB", "MB", "GB", "TB", "PB", "EB"}
		ii := []string{"B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"}
		for k, o := range []string{BytesN(s, n), IBytesN(s, n)} {
			var v *big.Float
			if k == 0 {
				v = phBig(o, 1000, si)
			} else {
				v = phBig(o, 1024, ii)
			}
			f, _ := v.Float64()
			rel := math.Abs(f-float64(s)) / float64(s)
			if rel > 0.06 {
				t.Fatalf("%q far from %d", o, s)
			}
		}
	})
}

func TestPhMonotonic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := phU64().Draw(t, "a")
		b := phU64().Draw(t, "b")
		if a > b {
			a, b = b, a
		}
		si := []string{"B", "kB", "MB", "GB", "TB", "PB", "EB"}
		fa, _ := phBig(BytesN(a, 6), 1000, si).Float64()
		fb, _ := phBig(BytesN(b, 6), 1000, si).Float64()
		if fa > fb {
			t.Fatalf("not monotonic %d %d: %s %s", a, b, BytesN(a, 6), BytesN(b, 6))
		}
	})
}

func TestPhUnitChoice(t *testing.T) {
	// integer part before rounding should be in [1,base) of the chosen unit, unit must be largest fitting (except rounding carry)
	rapid.Check(t, func(t *rapid.T) {
		s := phU64().Draw(t, "s")
		o := IBytes(s)
		m := phRe.FindStringSubmatch(o)
		if s >= 1024 && m[3] == "B" {
			t.Fatalf("%d -> %q", s, o)
		}
		o = Bytes(s)
		m = phRe.FindStringSubmatch(o)
		if s >= 1000 && m[3] == "B" {
			t.Fatalf("%d -> %q", s, o)
		}
		if s >= 1000 {
			f, _ := strconv.ParseFloat(m[1]+"."+m[2]+"0", 64)
			if f < 1 || f >= 1000 {
				t.Fatalf("%d -> %q", s, o)
			}
		}
	})
}

func TestPhParseExact(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		k := rapid.SampledFrom([]string{"B", "KB", "kb", "KiB", "mib", "MB", "GiB", "gb", "TB", "PiB", "EB", "EiB", ""}).Draw(t, "unit")
		v := rapid.Uint64Range(0, 1<<40).Draw(t, "v")
		sp := rapid.SampledFrom([]string{"", " ", "  "}).Draw(t, "sp")
		got, err := ParseBytes(strconv.FormatUint(v, 10) + sp + k)
		m := bytesSizeTable[strings.ToLower(k)]
		w := new(big.Int).Mul(new(big.Int).SetUint64(v), new(big.Int).SetUint64(m))
		if !w.IsUint64() {
			if err == nil {
				t.Fatalf("expected overflow error")
			}
			return
		}
		if err != nil || got != w.Uint64() {
			t.Fatalf("got %d %v want %v", got, err, w)
		}
	})
}

func TestPhParseRoundTripExactMax(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		v := rapid.Uint64().Draw(t, "v")
		got, err := ParseBytes(strconv.FormatUint(v, 10))
		if err != nil || got != v {
			t.Fatalf("got %d %v want %d", got, err, v)
		}
	})
}

func TestPhParseFraction(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		ip := rapid.Uint64Range(0, 100000).Draw(t, "ip")
		fp := rapid.Uint64Range(0, 999).Draw(t, "fp")
		k := rapid.SampledFrom([]string{"KB", "MiB", "GB", "KiB"}).Draw(t, "u")
		str := strconv.FormatUint(ip, 10) + "." + strconv.FormatUint(fp+1000, 10)[1:] + " " + k
		got, err := ParseBytes(str)
		if err != nil {
			t.Fatalf("%q: %v", str, err)
		}
		m := bytesSizeTable[strings.ToLower(k)]
		want := (ip*1000 + fp) * m / 1000
		if d := int64(got) - int64(want); d < -1 || d > 1 {
			t.Fatalf("%q got %d want %d", str, got, want)
		}
	})
}

func TestPhParseNoPanic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		_, _ = ParseBytes(s)
	})
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[0-9.,٣ ]{0,6}[a-zA-Z ]{0,4}`).Draw(t, "s")
		_, _ = ParseBytes(s)
	})
}

func TestPhFormatParse(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phU64().Draw(t, "s")
		if s > math.MaxUint64-1<<50 {
			t.Skip()
		}
		for _, o := range []string{BytesN(s, 6), IBytesN(s, 6)} {
			got, err := ParseBytes(o)
			if err != nil {
				t.Fatalf("%q: %v", o, err)
			}
			if s > 0 && math.Abs(float64(got)-float64(s))/float64(s) > 0.01 {
				t.Fatalf("%d -> %q -> %d", s, o, got)
			}
		}
	})
}
