"""EvilTime release versioning, independent from the upstream package."""

from __future__ import annotations

import os
from pathlib import Path

DEFAULT_EVILTIME_VERSION = "5.11.4-evil"


def get_eviltime_version() -> str:
    override = (os.getenv("EVILTIME_VERSION") or "").strip()
    if override:
        return override
    try:
        value = (Path(__file__).resolve().parent.parent / "EVILTIME_VERSION").read_text(encoding="utf-8").strip()
        return value or DEFAULT_EVILTIME_VERSION
    except OSError:
        return DEFAULT_EVILTIME_VERSION
