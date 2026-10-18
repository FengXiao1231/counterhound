package xstrings

import (
	"strings"
	"testing"

	"pgregory.net/rapid"
)

func TestPhDocSamples(t *testing.T) {
	m := map[string]string{"FirstName": "first_name", "HTTPServer": "http_server", "NoHTTPS": "no_https",
		"GO_PATH": "go_path", "GO PATH": "go_path", "GO-PATH": "go_path", "http2xx": "http_2xx",
		"HTTP20xOK": "http_20x_ok", "Duration2m3s": "duration_2m3s", "Bld4Floor3rd": "bld4_floor_3rd"}
	for in, want := range m {
		if got := ToSnakeCase(in); got != want {
			t.Errorf("%q: %q != %q", in, got, want)
		}
		if got := ToKebabCase(in); got != strings.ReplaceAll(want, "_", "-") {
			t.Errorf("%q: %q", in, got)
		}
	}
}

func TestPhSnakeWide(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z0-9_ .,éÉßǅ]{0,12}`).Draw(t, "s")
		a := ToSnakeCase(s)
		if b := ToSnakeCase(a); a != b {
			t.Fatalf("%q -> %q -> %q", s, a, b)
		}
		if strings.ContainsAny(a, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
			t.Fatalf("upper left %q -> %q", s, a)
		}
	})
}

func TestPhSnakeNoDoubleConnectorOrEdge(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.StringMatching(`[A-Za-z0-9]{1,12}`).Draw(t, "s")
		a := ToSnakeCase(s)
		if strings.HasPrefix(a, "_") || strings.HasSuffix(a, "_") || strings.Contains(a, "__") {
			t.Fatalf("%q -> %q", s, a)
		}
	})
}
