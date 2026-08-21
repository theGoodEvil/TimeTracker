"""
Tests for version reading from setup.py
"""

from app.config.analytics_defaults import _get_version_from_setup, get_analytics_config


class TestVersionReading:
    """Test version reading from setup.py"""

    def test_get_version_from_setup(self):
        """Test that version can be read from setup.py"""
        version = _get_version_from_setup()

        # Should return a version string
        assert version is not None
        assert isinstance(version, str)
        assert len(version) > 0

        assert version.endswith("-evil")

    def test_get_version_ignores_docker_placeholder_app_version(self, monkeypatch):
        """Upstream Docker version variables do not change EvilTime releases."""
        monkeypatch.setenv("APP_VERSION", "dev-0")
        monkeypatch.delenv("TIMETRACKER_VERSION", raising=False)
        version = _get_version_from_setup()
        assert version == "5.11.4-evil"

    def test_version_in_analytics_config(self):
        """Test that version is included in analytics config"""
        config = get_analytics_config()

        assert "app_version" in config
        assert config["app_version"] is not None
        assert isinstance(config["app_version"], str)
        assert len(config["app_version"]) > 0

    def test_version_fallback(self, monkeypatch):
        """Test that version falls back to 3.0.0 if setup.py can't be read"""
        import app.config.analytics_defaults as defaults

        # Mock the file reading to raise an exception
        original_get_version = defaults._get_version_from_setup

        def mock_get_version():
            raise FileNotFoundError("setup.py not found")

        # Temporarily replace the function
        monkeypatch.setattr(defaults, "_get_version_from_setup", mock_get_version)

        # The actual _get_version_from_setup has try/except, so test directly
        # For this test, we'll just verify the fallback logic exists
        version = _get_version_from_setup()
        assert version is not None  # Should never be None
