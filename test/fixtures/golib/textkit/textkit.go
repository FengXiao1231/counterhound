// Package textkit has small text and slice helpers.
//
// This is a counterhound test fixture: several functions contain planted bugs.
package textkit

import (
	"sort"
	"strconv"
	"strings"
)

// Chunk splits s into consecutive chunks of length n. The last chunk may be
// shorter. Concatenating the chunks gives back s. n must be positive.
func Chunk(s []int, n int) [][]int {
	if n <= 0 {
		panic("textkit: chunk size must be positive")
	}
	var out [][]int
	for i := 0; i+n <= len(s); i += n { // BUG: drops the final partial chunk
		out = append(out, s[i:i+n])
	}
	return out
}

// Reverse returns s with its runes in reverse order.
func Reverse(s string) string {
	b := []byte(s) // BUG: reverses bytes, which breaks multi-byte runes
	for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	return string(b)
}

// Median returns the median of xs. It returns 0 for an empty slice.
func Median(xs []float64) float64 {
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	n := len(s)
	if n%2 == 1 {
		return s[n/2]
	}
	return (s[n/2-1] + s[n/2]) / 2 // BUG: panics on empty input
}

// EncodeRLE run-length encodes s as count+letter pairs, e.g. "aaab" -> "3a1b".
// s must consist of letters only. DecodeRLE is its inverse.
func EncodeRLE(s string) string {
	var sb strings.Builder
	r := []rune(s)
	for i := 0; i < len(r); {
		j := i
		for j < len(r) && r[j] == r[i] {
			j++
		}
		sb.WriteString(strconv.Itoa(j - i))
		sb.WriteRune(r[i])
		i = j
	}
	return sb.String()
}

// DecodeRLE decodes the output of EncodeRLE.
func DecodeRLE(s string) string {
	var sb strings.Builder
	r := []rune(s)
	for i := 0; i+1 < len(r); i += 2 { // BUG: assumes single-digit counts
		n, _ := strconv.Atoi(string(r[i]))
		sb.WriteString(strings.Repeat(string(r[i+1]), n))
	}
	return sb.String()
}

// Range is the half-open interval [Lo, Hi).
type Range struct{ Lo, Hi int }

// Contains reports whether x is in the half-open range [Lo, Hi).
func (r Range) Contains(x int) bool {
	return r.Lo <= x && x <= r.Hi // BUG: Hi is excluded
}

// Len returns the number of integers in the range, or 0 if Hi <= Lo.
func (r Range) Len() int {
	if r.Hi <= r.Lo {
		return 0
	}
	return r.Hi - r.Lo
}

// MustPositive returns x. It panics if x is negative; that is documented,
// intended behaviour.
func MustPositive(x int) int {
	if x < 0 {
		panic("textkit: negative value")
	}
	return x
}
