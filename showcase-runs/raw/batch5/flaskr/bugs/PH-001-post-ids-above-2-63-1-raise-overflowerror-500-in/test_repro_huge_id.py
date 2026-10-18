def test_huge_id_is_404(client, auth):
    auth.login()
    big = 2**63
    assert client.get(f"/{big}/update").status_code == 404
    assert client.post(f"/{big}/update", data={"title": "x", "body": ""}).status_code == 404
    assert client.post(f"/{big}/delete").status_code == 404
