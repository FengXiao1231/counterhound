TITLE: With EnableSmartTruncate = false and the default MaxLength = 0, Make returns an empty string
REPO: gosimple/slug
SEARCH: EnableSmartTruncate empty
BODY:
`slug.go` line 131:

```go
if !EnableSmartTruncate && len(slug) >= MaxLength {
	slug = slug[:MaxLength]
}
```

`MaxLength` defaults to 0 and the doc comment says "By default slugs aren't shortened", but this branch has no `MaxLength > 0` guard, so turning smart truncation off without also setting a length cuts every slug to `""`:

```go
slug.EnableSmartTruncate = false
fmt.Printf("%q\n", slug.Make("hello world")) // ""  (expected "hello-world")
```

The smart branch a few lines later does check `MaxLength > 0 && EnableSmartTruncate`, so the two settings behave differently. Reproduced on master (62efd7f).

### Fix

```go
if !EnableSmartTruncate && MaxLength > 0 && len(slug) >= MaxLength {
```

### Related: truncation can leave a trailing separator, which `IsSlug` then rejects

```go
slug.MaxLength = 2
s := slug.Make("0_0")     // "0_"
slug.IsSlug(s)            // false
```

`IsSlug` is documented as accepting everything `Make` produces, and the function already trims leading and trailing `-`/`_` before truncating; trimming once more after truncation (both the smart and the plain branch) would close this.

Both found by property-based tests (`IsSlug(Make(x))` for all `x`). I can send a PR for both if you like.
