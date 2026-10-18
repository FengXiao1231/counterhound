package runewidth

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func phStr() *rapid.Generator[string] {
	return rapid.StringOf(rapid.SampledFrom([]rune{'a', 'b', ' ', 'あ', '世', 'é', '́', '‍', '👨', '👩', '🇯', '🇵', 'ก', 'ำ', '️', '1', 'ｱ'}))
}

func phCond(t *rapid.T) *Condition {
	c := NewCondition()
	c.EastAsianWidth = rapid.Bool().Draw(t, "ea")
	return c
}

func TestPhTruncateFits(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		c := phCond(t)
		s := phStr().Draw(t, "s")
		w := rapid.IntRange(0, 12).Draw(t, "w")
		tail := rapid.SampledFrom([]string{"", ".", "...", "…"}).Draw(t, "tail")
		if c.StringWidth(tail) > w {
			t.Skip()
		}
		got := c.Truncate(s, w, tail)
		if c.StringWidth(got) > w && c.StringWidth(s) > w {
			t.Fatalf("Truncate(%q,%d,%q)=%q width %d", s, w, tail, got, c.StringWidth(got))
		}
	})
}

func TestPhTruncatePrefixFits(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		c := phCond(t)
		s := phStr().Draw(t, "s")
		w := rapid.IntRange(0, 12).Draw(t, "w")
		prefix := rapid.SampledFrom([]string{"", ".", "...", "…"}).Draw(t, "p")
		if c.StringWidth(prefix) > w {
			t.Skip()
		}
		got := c.TruncatePrefix(s, w, prefix)
		if c.StringWidth(got) > w {
			t.Fatalf("TruncatePrefix(%q,%d,%q)=%q width %d", s, w, prefix, got, c.StringWidth(got))
		}
	})
}

func TestPhTruncatePrefixSuffix(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		c := phCond(t)
		s := phStr().Draw(t, "s")
		w := rapid.IntRange(1, 12).Draw(t, "w")
		got := c.TruncatePrefix(s, w, "")
		if !strings.HasSuffix(s, got) {
			t.Fatalf("TruncatePrefix(%q,%d)=%q not suffix", s, w, got)
		}
	})
}

func TestPhTruncateLeft(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		c := phCond(t)
		s := phStr().Draw(t, "s")
		w := rapid.IntRange(0, 12).Draw(t, "w")
		got := c.TruncateLeft(s, w, "")
		sw := c.StringWidth(s)
		if sw <= w {
			if got != "" {
				t.Fatalf("expected empty, got %q", got)
			}
			return
		}
		if gw := c.StringWidth(got); gw != sw-w {
			t.Fatalf("TruncateLeft(%q,%d)=%q width %d want %d", s, w, got, gw, sw-w)
		}
	})
}

func TestPhWrap(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		c := phCond(t)
		s := phStr().Draw(t, "s")
		w := rapid.IntRange(4, 12).Draw(t, "w")
		got := c.Wrap(s, w)
		if strings.Contains(got, "\n\n") && !strings.Contains(s, "\n") {
			t.Fatalf("Wrap(%q,%d)=%q empty line", s, w, got)
		}
		if strings.ReplaceAll(got, "\n", "") != strings.ReplaceAll(s, "\n", "") {
			t.Fatalf("Wrap(%q,%d)=%q content changed", s, w, got)
		}
		for _, l := range strings.Split(got, "\n") {
			if c.StringWidth(l) > w {
				t.Fatalf("Wrap(%q,%d)=%q line %q too wide", s, w, got, l)
			}
		}
	})
}
