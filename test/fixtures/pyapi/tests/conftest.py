import pytest
from fastapi.testclient import TestClient

from app.main import DB, NEXT, app


@pytest.fixture
def client() -> TestClient:
    """A test client on a fresh, empty inventory."""
    DB.clear()
    NEXT["id"] = 1
    return TestClient(app)
