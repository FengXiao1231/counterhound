import { Cart } from '../src/cart.js';

/** A cart holding two of one item, as most checkout tests start from. */
export function makeCart() {
  const c = new Cart();
  c.add('apple', 100, 2);
  return c;
}
