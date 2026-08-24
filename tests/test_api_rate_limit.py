from flask import Flask

from app.utils import api_rate_limit


def _test_app(database_uri):
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=database_uri,
        API_TOKEN_RATE_LIMIT_PER_MINUTE=1,
        API_TOKEN_RATE_LIMIT_PER_HOUR=2,
        REDIS_ENABLED=False,
    )
    return app


def test_local_rate_limits_are_isolated_by_database():
    api_rate_limit._LOCAL_MINUTE.clear()
    api_rate_limit._LOCAL_HOUR.clear()
    first_app = _test_app("sqlite:///first.sqlite")
    second_app = _test_app("sqlite:///second.sqlite")

    with first_app.app_context():
        assert api_rate_limit.consume_api_token_rate_limit(1)[0] is True
        assert api_rate_limit.consume_api_token_rate_limit(1)[0] is False

    with second_app.app_context():
        assert api_rate_limit.consume_api_token_rate_limit(1)[0] is True
