package syntax

import "testing"

func TestReproOffsetAfterRangeOpen(t *testing.T) {
	l := NewLexer("[a-c]")
	tk := l.Next()
	if tk.Type != RangeOpen {
		t.Fatalf("unexpected token %v", tk)
	}
	if got := l.Offset(); got != 1 {
		t.Fatalf("Offset() after %v = %d, want 1 (right after the returned token)", tk, got)
	}
}
