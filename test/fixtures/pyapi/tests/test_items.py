def test_create(client):
    r = client.post("/items", json={"name": "a", "price": 1})
    assert r.status_code == 201
