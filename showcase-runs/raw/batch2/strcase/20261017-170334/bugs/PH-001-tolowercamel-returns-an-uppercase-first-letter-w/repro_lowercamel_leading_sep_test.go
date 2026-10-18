package strcase

import "testing"

func TestReproLowerCamelLeadingSeparator(t *testing.T) {
	if got := ToLowerCamel("_some_string"); got != "someString" {
		t.Fatalf("ToLowerCamel(%q) = %q, want %q", "_some_string", got, "someString")
	}
}
