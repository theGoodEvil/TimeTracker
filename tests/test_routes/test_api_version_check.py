"""EvilTime does not poll or dismiss upstream release notifications."""


def test_upstream_version_check_is_not_exposed(admin_authenticated_client):
    assert admin_authenticated_client.get("/api/version/check").status_code == 404


def test_upstream_version_dismiss_is_not_exposed(admin_authenticated_client):
    assert admin_authenticated_client.post("/api/version/dismiss", json={"latest_version": "9.9.9"}).status_code == 404
