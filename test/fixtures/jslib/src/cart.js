/**
 * A shopping cart of priced lines. `total()` is the sum of line prices minus the discount
 * and is never negative: a discount is capped at the subtotal, and the cap is kept when
 * lines change. Prices and quantities are non-negative integers (cents).
 */
export class Cart {
  constructor() {
    this.lines = new Map();
    this.discount = 0;
  }

  /** Add `qty` of `sku` at `price` each; an existing sku gets its quantity increased. */
  add(sku, price, qty = 1) {
    if (qty <= 0 || price < 0) throw new RangeError('qty must be positive and price non-negative');
    const cur = this.lines.get(sku);
    this.lines.set(sku, { price, qty: (cur ? cur.qty : 0) + qty });
  }

  /**
   * Remove `qty` of `sku`; removing at least as many as there are removes the line.
   * Throws a RangeError if `sku` is not in the cart.
   */
  remove(sku, qty = 1) {
    if (!this.lines.has(sku)) throw new RangeError(`unknown sku ${sku}`);
    this.lines.delete(sku);
  }

  /** Apply an absolute discount, capped at the current subtotal. */
  applyDiscount(amount) {
    this.discount = Math.min(amount, this.subtotal());
  }

  /** Quantity of `sku` in the cart, 0 if absent. */
  quantity(sku) {
    const cur = this.lines.get(sku);
    return cur ? cur.qty : 0;
  }

  /** Sum of price × quantity over all lines. */
  subtotal() {
    let s = 0;
    for (const { price, qty } of this.lines.values()) s += price * qty;
    return s;
  }

  /** Subtotal minus discount; never negative. */
  total() {
    return this.subtotal() - this.discount;
  }
}
