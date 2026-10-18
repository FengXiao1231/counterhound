import pytest

from textkit.cart import Cart


@pytest.fixture
def cart() -> Cart:
    """A cart holding two of one item, as most checkout tests start from."""
    c = Cart()
    c.add("apple", 100, qty=2)
    return c
