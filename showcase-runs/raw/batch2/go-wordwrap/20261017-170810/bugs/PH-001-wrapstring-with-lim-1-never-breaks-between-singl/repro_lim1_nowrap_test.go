package wordwrap

import "testing"

func TestReproLim1NoWrap(t *testing.T) {
	got := WrapString("a b", 1)
	if want := "a\nb"; got != want {
		t.Fatalf("WrapString(%q, 1) = %q, want %q", "a b", got, want)
	}
}
