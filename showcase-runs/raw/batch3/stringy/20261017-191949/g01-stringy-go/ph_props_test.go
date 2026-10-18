package stringy

import (
	"testing"

	"pgregory.net/rapid"
)

func TestPhNewGet(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		s := rapid.String().Draw(t, "s")
		if got := New(s).Get(); got != s {
			t.Fatalf("Get=%q want %q", got, s)
		}
	})
}

func TestPhNewAfterRelease(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := rapid.String().Draw(t, "a")
		b := rapid.String().Draw(t, "b")
		x := New(a)
		x.ToUpper()
		x.Boolean()
		x.(*input).Release()
		y := New(b)
		if y.Get() != b || y.Error() != nil {
			t.Fatalf("stale state: %q %v", y.Get(), y.Error())
		}
	})
}

func TestPhNewIndependent(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := rapid.String().Draw(t, "a")
		b := rapid.String().Draw(t, "b")
		x := New(a)
		y := New(b)
		x.Trim()
		if y.Get() != b {
			t.Fatalf("interference: %q want %q", y.Get(), b)
		}
		if x.Error() != nil || y.Error() != nil {
			t.Fatalf("fresh error")
		}
	})
}
