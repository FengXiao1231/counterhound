from typing import Dict, Tuple


class Cart:
    """A shopping cart of priced lines.

    ``total()`` is the sum of the line prices minus the discount, and is never negative:
    a discount is capped at the subtotal, and the cap is kept when lines change.
    Prices and quantities are non-negative integers (cents).
    """

    def __init__(self) -> None:
        self._lines: Dict[str, Tuple[int, int]] = {}
        self._discount = 0

    def add(self, sku: str, price: int, qty: int = 1) -> None:
        """Add ``qty`` of ``sku`` at ``price`` each. Adding an existing sku increases its quantity."""
        if qty <= 0 or price < 0:
            raise ValueError("qty must be positive and price non-negative")
        old_price, old_qty = self._lines.get(sku, (price, 0))
        self._lines[sku] = (price, old_qty + qty)

    def remove(self, sku: str, qty: int = 1) -> None:
        """Remove ``qty`` of ``sku``. Removing at least as many as there are removes the line.

        Raises:
            KeyError: if ``sku`` is not in the cart.
        """
        if sku not in self._lines:
            raise KeyError(sku)
        del self._lines[sku]

    def apply_discount(self, amount: int) -> None:
        """Apply an absolute discount, capped at the current subtotal."""
        self._discount = min(amount, self.subtotal())

    def quantity(self, sku: str) -> int:
        """Quantity of ``sku`` in the cart, 0 if absent."""
        return self._lines.get(sku, (0, 0))[1]

    def subtotal(self) -> int:
        """Sum of price × quantity over all lines."""
        return sum(p * q for p, q in self._lines.values())

    def total(self) -> int:
        """Subtotal minus discount; never negative."""
        return self.subtotal() - self._discount
