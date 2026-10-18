from config import Config
from app import create_app, db


class Cfg(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    ELASTICSEARCH_URL = None


def test_create_user_null_password_is_4xx_not_crash():
    app = create_app(Cfg)
    app.config["TESTING"] = True
    with app.app_context():
        db.create_all()
        r = app.test_client().post("/api/users", json={
            "username": "a", "email": "a@x.org", "password": None})
        assert 400 <= r.status_code < 500
