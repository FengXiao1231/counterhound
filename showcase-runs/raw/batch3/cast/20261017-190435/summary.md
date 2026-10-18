<!-- counterhound-report -->
### counterhound found 1 provable bug (1 with a verified fix)

Checked 11 functions in 2 modules with property-based tests. 2 reported → 2 reproduced → 2 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> ToStringMapIntE/ToStringMapInt64E panic on maps with non-string keys (reflect fallback) <sub>(crash, map.go:191)</sub></summary>

| | |
|---|---|
| Function | `github.com/spf13/cast.ToStringMapIntE` |
| Input | ToStringMapIntE(map[int]int{0: 0}) (same for ToStringMapInt64E(map[int]int64{0:0})) |
| Expected | map[string]int{"0": 0} (keys converted like the map[any]T case uses ToString) or at least a non-nil error |
| Actual | panic: reflect.Value.SetMapIndex: value of type int is not assignable to type string |
| Review | medium severity, confidence 0.93 |

In toStringMapIntE (map.go:178-192), any map kind that misses the typed cases reaches the reflect fallback. That fallback calls SetMapIndex on a map[string]T with the original key, so any non-string key type, such as map[int]int, panics with 'value of type int is not assignable to type string'. The fallback's existing error check shows it is meant to return an error for uncastable input, and the map[any]T and map[any]any cases already convert keys with ToString. An E-variant taking `any` should return a result or an error, not panic, so a maintainer would take a small fix: convert the key with

Failing test (`repro_int_nonstring_key_panic_test.go`, failed 3/3 runs):

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

Suggested fix (the repro passes with it; project tests passed (go test -count=1 ./...)):

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
</details>

<sub>1m25s · $0.50 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
