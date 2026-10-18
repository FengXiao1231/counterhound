package slug

import "testing"

func TestReproTruncateTrailingUnderscore(t *testing.T) {
	MaxLength = 2
	defer func() { MaxLength = 0 }()
	got := Make("0_0")
	if got != "" && !IsSlug(got) {
		t.Fatalf("Make(\"0_0\") with MaxLength=2 = %q, not a valid slug", got)
	}
}
