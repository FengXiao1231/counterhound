# Format/String negates d.duration in place for negative durations, so repeated calls give wrong output

| | |
|---|---|
| Function | `github.com/hako/durafmt.(*Durafmt).Format` in `durafmt.go` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.95, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** d := Parse(-1000 * time.Nanosecond); d.String() twice

**Expected:** "-1 microsecond" both times; Duration() still -1µs

**Actual:** first call "-1 microsecond", second call "-"; Duration() returns +1µs after formatting (d.duration = -d.duration is written back to the receiver while d.input still starts with '-')

## Reproduce

```go
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
```

Fails with `AssertionError: String() not repeatable: first "-1 microsecond", second "-"`

Copy it into the package directory as `repro_format_mutates_negative_test.go` and run `go test -run Repro .`.

## Suggested fix

The repro passes with this patch; the project's tests passed (go test -count=1 ./...). Apply it with `git apply fix.patch`.

```diff
diff --git a/durafmt.go b/durafmt.go
index 128726e..ea320c8 100644
--- a/durafmt.go
+++ b/durafmt.go
@@ -87,11 +87,12 @@ func (d *Durafmt) String() string {
 // Format parses d *Durafmt into a human readable duration with units.
 func (d *Durafmt) Format(units Units) string {
 	var duration string
+	dur := d.duration
 
 	// Check for minus durations.
 	if string(d.input[0]) == "-" {
 		duration += "-"
-		d.duration = -d.duration
+		dur = -dur
 	}
 
 	var microseconds int64
@@ -104,7 +105,7 @@ func (d *Durafmt) Format(units Units) string {
 	var years int64
 	var shouldConvert = false
 
-	remainingSecondsToConvert := int64(d.duration / time.Microsecond)
+	remainingSecondsToConvert := int64(dur / time.Microsecond)
 
 	// Convert duration.
 	if d.limitUnit == "" {
@@ -178,7 +179,7 @@ func (d *Durafmt) Format(units Units) string {
 		case v == 1:
 			duration += strval + " " + u.Singular + " "
 		// omit any value with 0s or 0.
-		case d.duration.String() == "0" || d.duration.String() == "0s":
+		case dur.String() == "0" || dur.String() == "0s":
 			pattern := fmt.Sprintf("^-?0%s$", unitsShort[i])
 			isMatch, err := regexp.MatchString(pattern, d.input)
 			if err != nil {
@@ -210,11 +211,12 @@ func (d *Durafmt) Format(units Units) string {
 
 func (d *Durafmt) InternationalString() string {
 	var duration string
+	dur := d.duration
 
 	// Check for minus durations.
 	if string(d.input[0]) == "-" {
 		duration += "-"
-		d.duration = -d.duration
+		dur = -dur
 	}
 
 	var microseconds int64
@@ -227,7 +229,7 @@ func (d *Durafmt) InternationalString() string {
 	var years int64
 	var shouldConvert = false
 
-	remainingSecondsToConvert := int64(d.duration / time.Microsecond)
+	remainingSecondsToConvert := int64(dur / time.Microsecond)
 
 	// Convert duration.
 	if d.limitUnit == "" {
@@ -299,7 +301,7 @@ func (d *Durafmt) InternationalString() string {
 		case v > 0:
 			duration += strval + " " + u + " "
 		// omit any value with 0.
-		case d.duration.String() == "0":
+		case dur.String() == "0":
 			pattern := fmt.Sprintf("^-?0%s$", unitsShort[i])
 			isMatch, err := regexp.MatchString(pattern, d.input)
 			if err != nil {
```

## Why this is a bug

Format is a pure formatting method (String() is also used by fmt via Stringer, and Duration() is a getter); the code negates d.duration in place at durafmt.go:94 whenever input[0]=='-', so each call flips the sign again and formatting has side effects.

Independent review: durafmt.go:94 does `d.duration = -d.duration` on the receiver whenever input starts with '-', but input is never changed. The first call leaves the stored duration positive, and the second call negates it back to negative, so the unit calculations run on a negative value and the output collapses to "-". Nothing in the docs or tests suggests this is intentional. A pure formatter should be repeatable, and `Duration()` should not change after formatting. The fix is a one-line change to use a local copy of the duration, and a maintainer would take it.

## How it was found

Property: *Formatting the same *Durafmt twice returns the same string, and Duration() is unchanged by formatting*.

rapid shrank the failure to: `Failing test case: d: -1000`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
