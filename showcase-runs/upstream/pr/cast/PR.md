TITLE: Convert non-string map keys in ToStringMapIntE and ToStringMapInt64E
REPO: spf13/cast
BASE: master
BRANCH: fix-string-map-int-non-string-keys
SEARCH: ToStringMapIntE panic non-string keys
BODY:
Before: `cast.ToStringMapIntE(map[int]int{1: 33})` (and `ToStringMapInt64E`) panics with `reflect.Value.SetMapIndex: value of type int is not assignable to type string`, because the reflect fallback in `toStringMapIntE` copies the original key into the `map[string]T` result unchanged. `ToStringMapInt`, which is documented as the non-panicking variant, panics too.

After: the key is converted with `ToStringE`, so `map[int]int{1: 33}` becomes `map[string]int{"1": 33}`, as the `map[any]T` branch already does. A key that cannot be converted returns the usual conversion error instead of panicking.

How: one `ToStringE` call on `keyVal.Interface()` before `SetMapIndex`, plus two table cases in `map_test.go` for `map[int]int` and `map[int]int64`. `go test ./...` passes.
