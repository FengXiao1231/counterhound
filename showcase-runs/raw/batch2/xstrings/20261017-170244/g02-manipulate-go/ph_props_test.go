package xstrings

import (
	"strings"
	"testing"
	"unicode/utf8"

	"pgregory.net/rapid"
)

func phStr() *rapid.Generator[string] {
	return rapid.OneOf(rapid.String(), rapid.StringMatching(`[ab\x{FFFD}\xff\xc3 'é-]{0,10}`))
}

func TestPhReverseInvolutionValid(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		if got := Reverse(Reverse(s)); got != s {
			t.Fatalf("%q -> %q", s, got)
		}
		if len(Reverse(s)) != len(s) {
			t.Fatalf("len")
		}
	})
}

func TestPhReverseRunes(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		r := []rune(s)
		for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
			r[i], r[j] = r[j], r[i]
		}
		if got := Reverse(s); got != string(r) {
			t.Fatalf("%q: %q vs %q", s, got, string(r))
		}
	})
}

func TestPhSlice(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		r := []rune(s)
		a := rapid.IntRange(0, len(r)).Draw(t, "a")
		b := rapid.IntRange(a, len(r)).Draw(t, "b")
		if got := Slice(s, a, b); got != string(r[a:b]) {
			t.Fatalf("%q %d %d: %q", s, a, b, got)
		}
		if got := Slice(s, a, -1); got != string(r[a:]) {
			t.Fatalf("%q %d -1: %q", s, a, got)
		}
	})
}

func TestPhPartition(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phStr().Draw(t, "s")
		sep := phStr().Draw(t, "sep")
		if sep == "" {
			t.Skip()
		}
		h, m, tl := Partition(s, sep)
		if h+m+tl != s {
			t.Fatalf("concat")
		}
		if strings.Contains(s, sep) {
			if m != sep || strings.Contains(h+sep[:max(0, len(sep)-1)], sep) {
				t.Fatalf("%q %q: %q %q %q", s, sep, h, m, tl)
			}
		} else if h != s || m != "" || tl != "" {
			t.Fatalf("nomatch")
		}
	})
}

func TestPhLastPartition(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phStr().Draw(t, "s")
		sep := phStr().Draw(t, "sep")
		if sep == "" {
			t.Skip()
		}
		h, m, tl := LastPartition(s, sep)
		if h+m+tl != s {
			t.Fatalf("concat")
		}
		if strings.Contains(s, sep) {
			if m != sep || strings.Contains(tl, sep) {
				t.Fatalf("%q %q: %q %q %q", s, sep, h, m, tl)
			}
		} else if tl != s || m != "" || h != "" {
			t.Fatalf("nomatch")
		}
	})
}

func phScrubRef(s, repl string) string {
	var b strings.Builder
	in := false
	for len(s) > 0 {
		r, n := utf8.DecodeRuneInString(s)
		if r == utf8.RuneError {
			if !in {
				b.WriteString(repl)
				in = true
			}
		} else {
			in = false
			b.WriteString(s[:n])
		}
		s = s[n:]
	}
	return b.String()
}

func TestPhScrub(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phStr().Draw(t, "s")
		repl := rapid.StringMatching(`[?x]{0,2}`).Draw(t, "repl")
		if got, want := Scrub(s, repl), phScrubRef(s, repl); got != want {
			t.Fatalf("%q %q: %q want %q", s, repl, got, want)
		}
	})
}

func TestPhWordSplit(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := phStr().Draw(t, "s")
		var want []string
		var cur []rune
		in := false
		for _, r := range s {
			if r != utf8.RuneError && isAlphabet(r) {
				in = true
				cur = append(cur, r)
			} else if in && (r == '\'' || r == '-') {
				cur = append(cur, r)
			} else if in {
				want = append(want, string(cur))
				cur, in = nil, false
			}
		}
		if in {
			want = append(want, string(cur))
		}
		got := WordSplit(s)
		if len(got) != len(want) {
			t.Fatalf("%q: %q want %q", s, got, want)
		}
		for i := range got {
			if got[i] != want[i] {
				t.Fatalf("%q: %q want %q", s, got, want)
			}
		}
		if len(want) == 0 && got != nil {
			t.Fatalf("not nil")
		}
	})
}
