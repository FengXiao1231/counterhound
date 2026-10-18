package durafmt

import (
	"testing"
	"time"
)

func TestReproFormatMutatesNegative(t *testing.T) {
	d := Parse(-1000 * time.Nanosecond)
	first := d.String()
	second := d.String()
	if first != second {
		t.Fatalf("String() not repeatable: first %q, second %q", first, second)
	}
	if d.Duration() != -1000*time.Nanosecond {
		t.Fatalf("Duration() mutated to %v", d.Duration())
	}
}
