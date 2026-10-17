/**
 * Remove duplicates, keeping the FIRST element for each key, in original order.
 * @param {Array} items
 * @param {(x: any) => any} keyFn
 */
export function uniqueBy(items, keyFn) {
  const seen = new Map();
  for (const item of items) seen.set(keyFn(item), item);
  return [...seen.values()];
}

/**
 * Return the integers from `start` to `end` inclusive, counting by `step` (> 0).
 * @throws {RangeError} if step is not a positive integer.
 */
export function rangeInclusive(start, end, step = 1) {
  if (!Number.isInteger(step) || step <= 0) throw new RangeError('step must be a positive integer');
  const out = [];
  for (let i = start; i <= end; i += step) out.push(i);
  return out;
}

/** Split an array into pages of `size` items; returns the 1-based page `n` (empty if out of range). */
export function page(items, size, n) {
  return items.slice((n - 1) * size, n * size);
}
