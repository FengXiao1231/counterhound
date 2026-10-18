import base64
from config import Config
from app import create_app, db


class Cfg(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    ELASTICSEARCH_URL = None


def test_update_user_non_object_json_body_is_4xx_not_crash():
    app = create_app(Cfg)
    app.config["TESTING"] = True
    c = app.test_client()
    with app.app_context():
        db.create_all()
        assert c.post("/api/users", json={
            "username": "a", "email": "a@x.org", "password": "p"}).status_code == 201
        basic = {"Authorization": "Basic " + base64.b64encode(b"a:p").decode()}
        tok = c.post("/api/tokens", headers=basic).get_json()["token"]
        r = c.put("/api/users/1", json=0, headers={"Authorization": "Bearer " + tok})
        assert 400 <= r.status_code < 500
