from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_host: str
    app_port: int
    app_debug: bool
    monarch_base_url: str
    monarch_client_version: str | None
    monarch_timeout: int
    monarch_token: str | None
    monarch_persisted_token_path: Path
    monarch_email: str | None
    monarch_password: str | None
    monarch_mfa_secret_key: str | None


def _default_persisted_token_path(backend_dir: Path) -> Path:
    if not getattr(sys, "frozen", False):
        return backend_dir / ".state" / "monarch_token.json"

    if sys.platform == "darwin":
        support_dir = Path.home() / "Library" / "Application Support" / "Monarch Mac"
    elif os.name == "nt":
        support_dir = Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming")) / "Monarch Mac"
    else:
        support_dir = Path.home() / ".config" / "monarch-mac"

    return support_dir / "monarch_token.json"


def get_settings() -> Settings:
    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")
    persisted_token_path = os.getenv("MONARCH_PERSISTED_TOKEN_PATH")

    return Settings(
        app_host=os.getenv("APP_HOST", "127.0.0.1"),
        app_port=int(os.getenv("APP_PORT", "8000")),
        app_debug=_parse_bool(os.getenv("APP_DEBUG"), default=True),
        monarch_base_url=os.getenv("MONARCH_BASE_URL", "https://api.monarch.com").rstrip("/"),
        monarch_client_version=os.getenv("MONARCH_CLIENT_VERSION") or None,
        monarch_timeout=int(os.getenv("MONARCH_TIMEOUT", "20")),
        monarch_token=os.getenv("MONARCH_TOKEN") or None,
        monarch_persisted_token_path=(
            Path(persisted_token_path).expanduser()
            if persisted_token_path
            else _default_persisted_token_path(backend_dir)
        ),
        monarch_email=os.getenv("MONARCH_EMAIL") or None,
        monarch_password=os.getenv("MONARCH_PASSWORD") or None,
        monarch_mfa_secret_key=os.getenv("MONARCH_MFA_SECRET_KEY") or None,
    )
