from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .monarch_service import (
    LoginError,
    MFARequiredError,
    MonarchService,
    NotAuthenticatedError,
)
from .schemas import AuthStatusResponse, LoginRequest, LoginResponse

settings = get_settings()
service = MonarchService(settings)
static_dir = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="monarch-mac backend",
    version="0.1.0",
    description="Local API wrapper around the Monarch Money Python client.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.on_event("startup")
async def on_startup() -> None:
    await service.startup()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await service.shutdown()


@app.get("/", tags=["meta"])
async def root() -> Dict[str, Any]:
    return {
        "name": "monarch-mac backend",
        "login": "/login",
        "docs": "/docs",
        "authenticated": service.auth_status()["authenticated"],
    }


@app.get("/login", include_in_schema=False)
async def login_page() -> FileResponse:
    return FileResponse(static_dir / "login.html")


@app.get("/healthz", tags=["meta"])
async def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/auth/status", response_model=AuthStatusResponse, tags=["auth"])
async def auth_status() -> Dict[str, Any]:
    return service.auth_status()


@app.post("/auth/login", response_model=LoginResponse, tags=["auth"])
async def login(payload: LoginRequest) -> Dict[str, Any]:
    try:
        return await service.login(
            token=payload.token,
            email=payload.email,
            password=payload.password,
            mfa_code=payload.mfa_code,
            recovery_code=payload.recovery_code,
            email_otp=payload.email_otp,
            mfa_secret_key=payload.mfa_secret_key,
            trusted_device=payload.trusted_device,
        )
    except MFARequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc
    except LoginError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "login_failed", "message": str(exc)},
        ) from exc


@app.post("/auth/logout", tags=["auth"], status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    await service.logout()


@app.get("/accounts", tags=["monarch"])
async def get_accounts() -> Dict[str, Any]:
    try:
        return await service.get_accounts()
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/budgets", tags=["monarch"])
async def get_budgets(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
) -> Dict[str, Any]:
    try:
        return await service.get_budgets(start_date=start_date, end_date=end_date)
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/budgets/history", tags=["monarch"])
async def get_budget_history(
    months: int = Query(default=12, ge=2, le=24),
) -> Dict[str, Any]:
    try:
        return await service.get_budget_history(months=months)
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/transaction-categories", tags=["monarch"])
async def get_transaction_categories() -> Dict[str, Any]:
    try:
        return await service.get_transaction_categories()
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/transactions/summary", tags=["monarch"])
async def get_transactions_summary() -> Dict[str, Any]:
    try:
        return await service.get_transactions_summary()
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/transactions/summary/current-month", tags=["monarch"])
async def get_current_month_summary() -> Dict[str, Any]:
    try:
        return await service.get_current_month_summary()
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/cashflow/history", tags=["monarch"])
async def get_cashflow_history(
    months: int = Query(default=12, ge=2, le=24),
) -> Dict[str, Any]:
    try:
        return await service.get_cashflow_history(months=months)
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/transactions", tags=["monarch"])
async def get_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    search: str = Query(default=""),
    category_ids: Optional[List[str]] = Query(default=None),
    account_ids: Optional[List[str]] = Query(default=None),
) -> Dict[str, Any]:
    try:
        return await service.get_transactions(
            limit=limit,
            offset=offset,
            start_date=start_date,
            end_date=end_date,
            search=search,
            category_ids=category_ids,
            account_ids=account_ids,
        )
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/transactions/{transaction_id}", tags=["monarch"])
async def get_transaction_details(transaction_id: str) -> Dict[str, Any]:
    try:
        return await service.get_transaction_details(transaction_id)
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc


@app.get("/net-worth/history", tags=["monarch"])
async def get_net_worth_history(
    days: int = Query(default=180, ge=30, le=366),
) -> Dict[str, Any]:
    try:
        return await service.get_net_worth_history(days=days)
    except NotAuthenticatedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "not_authenticated", "message": str(exc)},
        ) from exc
