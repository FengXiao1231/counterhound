package runewidth

import "testing"

func TestPhProbe(t *testing.T) {
	c := NewCondition()
	for _, s := range []string{"あำ", "あ", "ำ", "ก", "กำ"} {
		t.Logf("%q sw=%d graphemeWidth=%d wrap1=%q wrap2=%q", s, c.StringWidth(s), c.graphemeWidth(s), c.Wrap(s, 1), c.Wrap(s, 2))
	}
	t.Fail()
}
