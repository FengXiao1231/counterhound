package cast

import "testing"

func TestReproIntNonStringKeyPanic(t *testing.T) {
	got, err := ToStringMapIntE(map[int]int{0: 0})
	if err == nil && len(got) != 1 {
		t.Fatalf("got %v", got)
	}
}
