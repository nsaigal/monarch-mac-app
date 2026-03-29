from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    token: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    mfa_code: Optional[str] = None
    recovery_code: Optional[str] = None
    email_otp: Optional[str] = None
    mfa_secret_key: Optional[str] = None
    trusted_device: bool = False


class LoginResponse(BaseModel):
    authenticated: bool
    auth_source: str
    mfa_required: bool = False


class AuthStatusResponse(BaseModel):
    authenticated: bool
    auth_source: Optional[str] = None
