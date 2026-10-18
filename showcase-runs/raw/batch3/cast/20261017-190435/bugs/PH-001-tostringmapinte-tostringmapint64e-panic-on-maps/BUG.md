# ToStringMapIntE/ToStringMapInt64E panic on maps with non-string keys (reflect fallback)

| | |
|---|---|
| Function | `github.com/spf13/cast.ToStringMapIntE` in `map.go:191` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.93, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** ToStringMapIntE(map[int]int{0: 0}) (same for ToStringMapInt64E(map[int]int64{0:0}))

**Expected:** map[string]int{"0": 0} (keys converted like the map[any]T case uses ToString) or at least a non-nil error

**Actual:** `panic: reflect.Value.SetMapIndex: value of type int is not assignable to type string`

## Reproduce

```go
package cast

import "testing"

func TestReproIntNonStringKeyPanic(t *testing.T) {
	got, err := ToStringMapIntE(map[int]int{0: 0})
	if err == nil && len(got) != 1 {
		t.Fatalf("got %v", got)
	}
}
```

Fails with `panic: reflect.Value.SetMapIndex: value of type int is not assignable to type string`

Copy it into the package directory as `repro_int_nonstring_key_panic_test.go` and run `go test -run Repro .`.

## Suggested fix

The repro passes with this patch; the project's tests passed (go test -count=1 ./...). Apply it with `git apply fix.patch`.

```diff
diff --git a/map.go b/map.go
index 858d4ee..991fe75 100644
--- a/map.go
+++ b/map.go
@@ -188,7 +188,12 @@ func toStringMapIntE[T int | int64](i any, fn func(any) T, fnE func(any) (T, err
 			return m, fmt.Errorf(errorMsg, i, i, m)
 		}
 
-		mVal.SetMapIndex(keyVal, reflect.ValueOf(val))
+		key, err := ToStringE(keyVal.Interface())
+		if err != nil {
+			return m, fmt.Errorf(errorMsg, i, i, m)
+		}
+
+		mVal.SetMapIndex(reflect.ValueOf(key), reflect.ValueOf(val))
 	}
 
 	return m, nil
```

## Why this is a bug

The function is an E-variant that returns an error for uncastable input; the reflect fallback is explicitly meant to accept arbitrary map kinds, and sibling ToStringMapStringE returns an error (not a panic) for map[int]string. The map[any]T and map[any]any branches convert keys with ToString, but the reflect fallback passes the original key to SetMapIndex.

Independent review: In toStringMapIntE (map.go:178-192), any map kind that misses the typed cases reaches the reflect fallback. That fallback calls SetMapIndex on a map[string]T with the original key, so any non-string key type, such as map[int]int, panics with 'value of type int is not assignable to type string'. The fallback's existing error check shows it is meant to return an error for uncastable input, and the map[any]T and map[any]any cases already convert keys with ToString. An E-variant taking `any` should return a result or an error, not panic, so a maintainer would take a small fix: convert the key with ToStringE, or return an error.

## How it was found

Property: *for any map input the function returns a result or an error, never panics; key count is preserved on success*.

rapid shrank the failure to: `Failing test case: m: map[int]int{0:0}`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
