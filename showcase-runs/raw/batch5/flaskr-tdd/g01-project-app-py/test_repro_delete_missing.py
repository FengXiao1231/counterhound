import os
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{Path(__file__).resolve().parent / 'repro.db'}"
from project.app import app, db

app.config["TESTING"] = True


def test_second_delete_reports_failure():
    with app.app_context():
        db.drop_all()
        db.create_all()
    c = app.test_client()
    c.post("/login", data=dict(username="admin", password="admin"))
    c.post("/add", data=dict(title="t", text="x"))
    first = c.get("/delete/1")
    assert first.get_json()["status"] == 1
    second = c.get("/delete/1")
    # post 1 no longer exists: must not report "Post Deleted"
    assert second.status_code == 404 or second.get_json()["status"] == 0
