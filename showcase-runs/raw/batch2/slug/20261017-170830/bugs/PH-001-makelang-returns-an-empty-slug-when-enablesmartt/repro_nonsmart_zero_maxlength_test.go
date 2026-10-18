package slug

import "testing"

func TestReproNonSmartZeroMaxLength(t *testing.T) {
	EnableSmartTruncate = false
	defer func() { EnableSmartTruncate = true }()
	if got := Make("a"); got != "a" {
		t.Fatalf("Make(\"a\") with MaxLength=0 and smart truncate off = %q, want \"a\"", got)
	}
}
