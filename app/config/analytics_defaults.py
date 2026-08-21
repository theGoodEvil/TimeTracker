"""
Analytics configuration for TimeTracker.

These values are embedded at build time and cannot be overridden by users.
This allows collecting anonymized usage metrics from all installations
to improve the product while respecting user privacy.

Key Privacy Protections:
- Telemetry is OPT-IN (disabled by default)
- No personally identifiable information is ever collected
- Users can disable telemetry at any time via admin dashboard
- All tracked events are documented and transparent

DO NOT commit actual keys to this file - they are injected at build time only.
"""

# OTEL OTLP Configuration
# Replaced by GitHub Actions: OTEL_EXPORTER_OTLP_ENDPOINT_PLACEHOLDER
# Replaced by GitHub Actions: OTEL_EXPORTER_OTLP_TOKEN_PLACEHOLDER
OTEL_EXPORTER_OTLP_ENDPOINT_DEFAULT = "%%OTEL_EXPORTER_OTLP_ENDPOINT_PLACEHOLDER%%"
OTEL_EXPORTER_OTLP_TOKEN_DEFAULT = "%%OTEL_EXPORTER_OTLP_TOKEN_PLACEHOLDER%%"

# Sentry Configuration
# Replaced by GitHub Actions: SENTRY_DSN_PLACEHOLDER
SENTRY_DSN_DEFAULT = "%%SENTRY_DSN_PLACEHOLDER%%"
SENTRY_TRACES_RATE_DEFAULT = "0.1"

# Telemetry Configuration
# All builds have analytics configured, but telemetry is OPT-IN
TELE_ENABLED_DEFAULT = "false"  # Disabled by default for privacy


def get_version_from_setup():
    """
    Return the EvilTime release version.

    The legacy function name is retained for API compatibility, but EvilTime's
    version is sourced from ``EVILTIME_VERSION`` / the ``EVILTIME_VERSION`` file
    and never from upstream package tags.

    Returns:
        str: EvilTime application version (for example ``evil1.0``)
    """
    from app.version import get_eviltime_version

    return get_eviltime_version()


# Keep the old function name for backward compatibility
_get_version_from_setup = get_version_from_setup


def get_analytics_config():
    """
    Get analytics configuration.

    Analytics keys are embedded at build time and cannot be overridden
    to ensure consistent telemetry collection across all installations.

    However, users maintain full control:
    - Telemetry is OPT-IN (disabled by default)
    - Can be disabled anytime in admin dashboard
    - No PII is ever collected

    Returns:
        dict: Analytics configuration
    """

    # Helper to check if a value is a placeholder (not replaced by GitHub Actions)
    def is_placeholder(value):
        return value.startswith("%%") and value.endswith("%%")

    # OTEL OTLP configuration - use embedded values (no override)
    otel_exporter_otlp_endpoint = (
        OTEL_EXPORTER_OTLP_ENDPOINT_DEFAULT if not is_placeholder(OTEL_EXPORTER_OTLP_ENDPOINT_DEFAULT) else ""
    )
    otel_exporter_otlp_token = (
        OTEL_EXPORTER_OTLP_TOKEN_DEFAULT if not is_placeholder(OTEL_EXPORTER_OTLP_TOKEN_DEFAULT) else ""
    )

    # Sentry configuration - use embedded keys (no override)
    sentry_dsn = SENTRY_DSN_DEFAULT if not is_placeholder(SENTRY_DSN_DEFAULT) else ""

    # App version - read from setup.py at runtime
    app_version = get_version_from_setup()

    # Note: Environment variables are NOT checked for keys to prevent override
    # Users control telemetry via the opt-in/opt-out toggle in admin dashboard

    return {
        "otel_exporter_otlp_endpoint": otel_exporter_otlp_endpoint,
        "otel_exporter_otlp_token": otel_exporter_otlp_token,
        "sentry_dsn": sentry_dsn,
        "sentry_traces_rate": float(SENTRY_TRACES_RATE_DEFAULT),  # Fixed rate, no override
        "app_version": app_version,
        "telemetry_enabled_default": False,  # Always opt-in
    }


def has_analytics_configured():
    """
    Check if analytics keys are configured (embedded at build time).

    Returns:
        bool: True if analytics keys are embedded
    """

    def is_placeholder(value):
        return value.startswith("%%") and value.endswith("%%")

    # Check if keys have been replaced during build
    return (not is_placeholder(OTEL_EXPORTER_OTLP_ENDPOINT_DEFAULT)) and (
        not is_placeholder(OTEL_EXPORTER_OTLP_TOKEN_DEFAULT)
    )
