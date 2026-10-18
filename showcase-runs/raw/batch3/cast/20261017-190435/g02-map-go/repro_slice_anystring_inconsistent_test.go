package cast

import (
	"reflect"
	"testing"
)

func TestReproSliceAnyStringInconsistent(t *testing.T) {
	want, _ := ToStringMapStringSliceE(map[string]string{"k": "a b"})
	got, err := ToStringMapStringSliceE(map[any]string{"k": "a b"})
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("map[any]string gave %q, map[string]string gave %q", got, want)
	}
}
