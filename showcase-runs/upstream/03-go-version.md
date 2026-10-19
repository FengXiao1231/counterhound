TITLE: Compare ignores the prerelease when the versions have a different number of segments (1.0.0.0-alpha == 1.0.0)
REPO: hashicorp/go-version
SEARCH: prerelease compare segments
BODY:
`Version.Compare` only looks at the prerelease when `equalSegments` is true, which requires the same number of segments. When the counts differ, it walks the segments, treats trailing zeros as equal, and returns 0 without ever looking at the prerelease. So:

```go
a := version.Must(version.NewVersion("1.0.0-alpha"))
b := version.Must(version.NewVersion("1.0.0.0-alpha"))
c := version.Must(version.NewVersion("1.0.0"))

a.Compare(c) // -1  (prerelease sorts before the release, as documented)
b.Compare(c) //  0  (expected -1: 1.0.0.0-alpha is the same version as 1.0.0-alpha)
a.Compare(b) //  0
```

Equality is not transitive: `a == b`, `b == c`, but `a != c`. In practice `Constraints` like `>= 1.0.0` accept `1.0.0.0-alpha`, while they reject `1.0.0-alpha`. Reproduced on main (5ca63ba).

### Suggested fix

At the end of `Compare`, where the segment loop found no difference, fall through to the same prerelease comparison that the `equalSegments` branch does, instead of `return 0`. Something like:

```go
// if we got this far, the segments are equal; decide on the prerelease
preSelf, preOther := v.Prerelease(), other.Prerelease()
switch {
case preSelf == "" && preOther == "":
	return 0
case preSelf == "":
	return 1
case preOther == "":
	return -1
}
return comparePrereleases(preSelf, preOther)
```

Found by a property-based test checking that `Equal` is transitive. Glad to turn this into a PR with a test if you would take it.
