package version

import "testing"

func TestReproPrereleaseIgnoredWithExtraSegment(t *testing.T) {
	pre := Must(NewVersion("1.0.0-alpha"))
	padded := Must(NewVersion("1.0.0.0-alpha"))
	rel := Must(NewVersion("1.0.0"))

	if pre.Compare(rel) != -1 {
		t.Fatalf("precondition: 1.0.0-alpha should be < 1.0.0")
	}
	if got := padded.Compare(rel); got != -1 {
		t.Fatalf("1.0.0.0-alpha.Compare(1.0.0) = %d, want -1", got)
	}
	if got := rel.Compare(padded); got != 1 {
		t.Fatalf("1.0.0.Compare(1.0.0.0-alpha) = %d, want 1", got)
	}
}
