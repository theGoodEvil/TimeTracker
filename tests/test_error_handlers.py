"""Regression tests for application-wide error handlers."""

from sqlalchemy.exc import IntegrityError


def test_html_integrity_error_handler_returns_a_valid_conflict_response(app):
    error = IntegrityError("delete failed", {}, Exception("foreign key violation"))

    with app.test_request_context("/dashboard/timeline/delete_event", method="POST"):
        handled = app.handle_user_exception(error)
        response = app.make_response(handled)

    assert response.status_code == 409
    assert b"Database Conflict" in response.data
    assert b"conflicts with related data" in response.data
