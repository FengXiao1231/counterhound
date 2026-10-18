package levenshtein

import (
	"math"
	"testing"

	"pgregory.net/rapid"
)

func phRef(a, b []rune, ins, sub, del int) int {
	prev := make([]int, len(b)+1)
	for j := range prev {
		prev[j] = j * ins
	}
	for i := 1; i <= len(a); i++ {
		cur := make([]int, len(b)+1)
		cur[0] = i * del
		for j := 1; j <= len(b); j++ {
			s := prev[j-1]
			if a[i-1] != b[j-1] {
				s += sub
			}
			m := s
			if v := prev[j] + del; v < m {
				m = v
			}
			if v := cur[j-1] + ins; v < m {
				m = v
			}
			cur[j] = m
		}
		prev = cur
	}
	return prev[len(b)]
}

func phStr() *rapid.Generator[[]rune] {
	return rapid.SliceOfN(rapid.SampledFrom([]rune("abcé世")), 0, 9)
}

func TestPhCalcExact(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, b := phStr().Draw(t, "a"), phStr().Draw(t, "b")
		ins, sub, del := rapid.IntRange(0, 5).Draw(t, "i"), rapid.IntRange(0, 5).Draw(t, "s"), rapid.IntRange(0, 5).Draw(t, "d")
		d, _, _ := Calculate(a, b, 0, ins, sub, del)
		if r := phRef(a, b, ins, sub, del); d != r {
			t.Fatalf("%q %q %d %d %d got %d want %d", string(a), string(b), ins, sub, del, d, r)
		}
	})
}

func TestPhCalcMax(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, b := phStr().Draw(t, "a"), phStr().Draw(t, "b")
		ins, sub, del := rapid.IntRange(0, 5).Draw(t, "i"), rapid.IntRange(0, 5).Draw(t, "s"), rapid.IntRange(0, 5).Draw(t, "d")
		mx := rapid.IntRange(0, 30).Draw(t, "max")
		d, _, _ := Calculate(a, b, mx, ins, sub, del)
		r := phRef(a, b, ins, sub, del)
		if mx == 0 || r <= mx {
			if d != r {
				t.Fatalf("%q %q c=%d,%d,%d max=%d got %d want %d", string(a), string(b), ins, sub, del, mx, d, r)
			}
		} else if d <= mx || d > r {
			t.Fatalf("%q %q c=%d,%d,%d max=%d got %d ref %d", string(a), string(b), ins, sub, del, mx, d, r)
		}
	})
}

func TestPhPrefixSuffix(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, b := phStr().Draw(t, "a"), phStr().Draw(t, "b")
		_, p, s := Calculate(a, b, 0, 1, 1, 1)
		wp := 0
		for wp < len(a) && wp < len(b) && a[wp] == b[wp] {
			wp++
		}
		ws := 0
		for ws < len(a)-wp && ws < len(b)-wp && a[len(a)-1-ws] == b[len(b)-1-ws] {
			ws++
		}
		if p != wp || s != ws {
			t.Fatalf("%q %q got %d %d want %d %d", string(a), string(b), p, s, wp, ws)
		}
	})
}

func phParams(t *rapid.T) *Params {
	return NewParams().InsCost(rapid.IntRange(0, 4).Draw(t, "i")).SubCost(rapid.IntRange(0, 4).Draw(t, "s")).DelCost(rapid.IntRange(0, 4).Draw(t, "d"))
}

func TestPhSimilarityRange(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, b := string(phStr().Draw(t, "a")), string(phStr().Draw(t, "b"))
		p := phParams(t)
		if rapid.Bool().Draw(t, "m") {
			p.MinScore(rapid.Float64Range(0, 1).Draw(t, "min"))
		}
		for _, v := range []float64{Similarity(a, b, p), Match(a, b, p)} {
			if math.IsNaN(v) || v < 0 || v > 1 {
				t.Fatalf("%q %q %+v -> %v", a, b, *p, v)
			}
		}
	})
}

func TestPhSimilarityIdentical(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := string(phStr().Draw(t, "a"))
		p := phParams(t)
		if Similarity(a, a, p) != 1 || Match(a, a, p) != 1 {
			t.Fatalf("%q %+v", a, *p)
		}
	})
}

func TestPhMinScoreConsistent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, b := string(phStr().Draw(t, "a")), string(phStr().Draw(t, "b"))
		p := NewParams().InsCost(rapid.IntRange(1, 3).Draw(t, "i")).SubCost(rapid.IntRange(1, 3).Draw(t, "s")).DelCost(rapid.IntRange(1, 3).Draw(t, "d"))
		min := rapid.Float64Range(0.01, 1).Draw(t, "min")
		base := Match(a, b, p)
		got := Match(a, b, p.Clone().MinScore(min))
		want := base
		if base < min {
			want = 0
		}
		if math.Abs(got-want) > 1e-9 {
			t.Fatalf("%q %q %+v min=%v got %v want %v", a, b, *p, min, got, want)
		}
		sb, sg := Similarity(a, b, p), Similarity(a, b, p.Clone().MinScore(min))
		w := sb
		if sb < min {
			w = 0
		}
		if math.Abs(sg-w) > 1e-9 {
			t.Fatalf("sim %q %q %+v min=%v got %v want %v", a, b, *p, min, sg, w)
		}
	})
}

func TestPhDistanceMatchesCalc(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a, b := rapid.String().Draw(t, "a"), rapid.String().Draw(t, "b")
		if Distance(a, b, nil) != phRef([]rune(a), []rune(b), 1, 1, 1) {
			t.Fatalf("%q %q", a, b)
		}
	})
}
