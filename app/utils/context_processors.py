from flask import current_app, g, request
from flask_babel import get_locale
from flask_login import current_user

from app.models import Settings
from app.utils.timezone import (
    get_resolved_date_format_key,
    get_resolved_time_format_key,
    get_resolved_week_start_day,
    get_timezone_offset_for_timezone,
)


def register_context_processors(app):
    """Register context processors for the application"""

    # Register permission helpers for templates
    from app.utils.permissions import init_permission_helpers

    init_permission_helpers(app)

    @app.context_processor
    def inject_settings():
        """Inject settings into all templates"""
        try:
            from app import db

            # Check if we have an active database session
            if db.session.is_active:
                settings = Settings.get_settings()
                resolved_date = get_resolved_date_format_key()
                resolved_time = get_resolved_time_format_key()
                resolved_week_start = get_resolved_week_start_day()
                ai_cfg = settings.get_ai_config()
                return {
                    "settings": settings,
                    "currency": settings.currency,
                    "timezone": settings.timezone,
                    "resolved_date_format_key": resolved_date,
                    "resolved_time_format_key": resolved_time,
                    "resolved_week_start_day": resolved_week_start,
                    "ai_enabled": bool(ai_cfg.get("enabled")),
                }
        except Exception as e:
            # Log the error but continue with defaults
            print(f"Warning: Could not inject settings: {e}")
            # Rollback the failed transaction
            try:
                from app import db

                db.session.rollback()
            except Exception:
                current_app.logger.debug("Could not roll back template settings session", exc_info=True)

        # Return defaults if settings not available (resolved keys still work without db)
        try:
            resolved_date = get_resolved_date_format_key()
            resolved_time = get_resolved_time_format_key()
            resolved_week_start = get_resolved_week_start_day()
        except Exception:
            resolved_date = "YYYY-MM-DD"
            resolved_time = "24h"
            resolved_week_start = 1
        try:
            ai_enabled = bool(current_app.config.get("AI_ENABLED", False))
        except Exception:
            ai_enabled = False
        return {
            "settings": None,
            "currency": "EUR",
            "timezone": "Europe/Rome",
            "resolved_date_format_key": resolved_date,
            "resolved_time_format_key": resolved_time,
            "resolved_week_start_day": resolved_week_start,
            "ai_enabled": ai_enabled,
        }

    @app.context_processor
    def inject_globals():
        """Inject global variables into all templates"""
        try:
            from app import db

            # Check if we have an active database session
            if db.session.is_active:
                settings = Settings.get_settings()
                timezone_name = settings.timezone if settings else "Europe/Rome"
            else:
                timezone_name = "Europe/Rome"
        except Exception as e:
            # Log the error but continue with defaults
            print(f"Warning: Could not inject globals: {e}")
            # Rollback the failed transaction
            try:
                from app import db

                db.session.rollback()
            except Exception:
                pass
            timezone_name = "Europe/Rome"

        # Resolve user-specific timezone, falling back to application timezone
        user_timezone = timezone_name
        try:
            if (
                current_user
                and getattr(current_user, "is_authenticated", False)
                and getattr(current_user, "timezone", None)
            ):
                user_timezone = current_user.timezone
        except Exception:
            pass

        # EvilTime has its own release sequence, independent from upstream.
        try:
            from app.version import get_eviltime_version

            version_value = get_eviltime_version()
        except Exception:
            version_value = "evil1.0"

        # Current locale code (e.g., 'en', 'de')
        try:
            current_locale = str(get_locale())
        except Exception:
            current_locale = "en"
        # Normalize to short code for comparisons (e.g., 'en' from 'en_US')
        short_locale = current_locale.split("_", 1)[0] if current_locale else "en"

        # Reverse-map normalized locale codes back to config keys for label lookup
        # 'nb' (used by Flask-Babel) should map back to 'no' (used in LANGUAGES config)
        display_locale = short_locale
        if short_locale == "nb":
            display_locale = "no"

        available_languages = current_app.config.get("LANGUAGES", {}) or {}
        current_language_label = available_languages.get(display_locale, short_locale.upper())

        # Check if current language is RTL
        rtl_languages = current_app.config.get("RTL_LANGUAGES", set())
        is_rtl = short_locale in rtl_languages

        is_admin_user = bool(
            getattr(current_user, "is_authenticated", False) and getattr(current_user, "is_admin", False)
        )

        return {
            "app_name": "EvilTime",
            "app_version": version_value,
            "is_admin_user": is_admin_user,
            "timezone": timezone_name,
            "timezone_offset": get_timezone_offset_for_timezone(timezone_name),
            "user_timezone": user_timezone,
            "current_locale": current_locale,
            "current_language_code": display_locale,  # Use display locale (e.g., 'no' not 'nb')
            "current_language_label": current_language_label,
            "is_rtl": is_rtl,
            "available_languages": available_languages,
            "config": current_app.config,
        }

    @app.context_processor
    def inject_theme():
        """Inject the per-user theme CSS into every template.

        Returns ``{"theme_css": ""}`` for anonymous users, unmigrated
        databases, or users on the default theme with no overrides — so
        existing users see zero visual change until they opt in via the
        theme picker.
        """
        try:
            if current_user and getattr(current_user, "is_authenticated", False):
                from app.services.theme_service import ThemeService

                return {"theme_css": ThemeService().get_theme_css_vars(current_user)}
        except Exception:
            # Theme injection must never break rendering. Fall through
            # to the empty default below.
            pass
        return {"theme_css": ""}

    @app.context_processor
    def inject_keyboard_shortcuts_config():
        """Inject keyboard shortcut config for logged-in users (for keyboard-shortcuts-advanced.js)."""
        try:
            if getattr(current_user, "is_authenticated", False):
                from app.utils.keyboard_shortcuts_defaults import merge_overrides

                overrides = getattr(current_user, "keyboard_shortcuts_overrides", None) or {}
                shortcuts = merge_overrides(overrides)
                return {"keyboard_shortcuts_config": {"shortcuts": shortcuts, "overrides": overrides}}
        except Exception:
            pass
        return {"keyboard_shortcuts_config": None}

    @app.before_request
    def before_request():
        """Set up request-specific data"""
        g.request_start_time = request.start_time if hasattr(request, "start_time") else None
