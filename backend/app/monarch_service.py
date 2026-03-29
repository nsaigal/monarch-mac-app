from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import oathtool
from aiohttp import ClientSession, ClientTimeout
from monarchmoney import MonarchMoney
from monarchmoney.monarchmoney import LoginFailedException, MonarchMoneyEndpoints

from .config import Settings

DEFAULT_MONARCH_CLIENT_VERSION = "web@1.0.1771"
REST_CLIENT_NAME = "monarch-core-web-app-rest"
GRAPHQL_CLIENT_NAME = "monarch-core-web-app-graphql"
CLIENT_PLATFORM = "web"


class MonarchServiceError(Exception):
    """Base service error."""


class NotAuthenticatedError(MonarchServiceError):
    """Raised when a request needs an authenticated Monarch client."""


class MFARequiredError(MonarchServiceError):
    """Raised when Monarch requires a one-time MFA code."""

    def __init__(self, message: str, *, code: str = "mfa_required") -> None:
        super().__init__(message)
        self.code = code


class LoginError(MonarchServiceError):
    """Raised when login fails."""


class MonarchService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Optional[MonarchMoney] = None
        self._auth_source: Optional[str] = None
        self._lock = asyncio.Lock()
        self._client_version = settings.monarch_client_version
        self._device_uuid = str(uuid.uuid4())
        MonarchMoneyEndpoints.BASE_URL = settings.monarch_base_url

    async def startup(self) -> None:
        if self._settings.monarch_token:
            await self.login(
                token=self._settings.monarch_token,
                auth_source="env_token",
                persist_token=False,
            )
            return

        persisted_token = self._load_persisted_token()
        if persisted_token:
            try:
                await self.login(
                    token=persisted_token,
                    auth_source="persisted_token",
                    persist_token=False,
                )
                return
            except LoginError:
                self._clear_persisted_token()

        if self._settings.monarch_email and self._settings.monarch_password:
            await self.login(
                email=self._settings.monarch_email,
                password=self._settings.monarch_password,
                mfa_secret_key=self._settings.monarch_mfa_secret_key,
            )

    async def shutdown(self) -> None:
        await self.logout(clear_persisted_token=False)

    def auth_status(self) -> Dict[str, Any]:
        return {
            "authenticated": self._client is not None,
            "auth_source": self._auth_source,
        }

    async def login(
        self,
        *,
        token: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        mfa_code: Optional[str] = None,
        recovery_code: Optional[str] = None,
        email_otp: Optional[str] = None,
        mfa_secret_key: Optional[str] = None,
        trusted_device: bool = False,
        auth_source: Optional[str] = None,
        persist_token: bool = True,
    ) -> Dict[str, Any]:
        async with self._lock:
            client = MonarchMoney(timeout=self._settings.monarch_timeout, token=token)
            await self._apply_client_metadata(client, client_name=GRAPHQL_CLIENT_NAME if token else REST_CLIENT_NAME)

            if token:
                await self._validate_client_token(client)
                self._client = client
                self._auth_source = auth_source or "token"
                if persist_token:
                    self._persist_token(token)
                return self.auth_status()

            if not email or not password:
                raise LoginError("Either a Monarch token or email/password is required.")

            try:
                await self._login_with_credentials(
                    client=client,
                    email=email,
                    password=password,
                    mfa_code=mfa_code,
                    recovery_code=recovery_code,
                    email_otp=email_otp,
                    trusted_device=trusted_device,
                    mfa_secret_key=mfa_secret_key,
                )
            except MFARequiredError:
                raise
            except LoginFailedException as exc:
                raise LoginError(str(exc)) from exc
            except Exception as exc:
                raise LoginError(str(exc)) from exc

            self._client = client
            await self._apply_client_metadata(client, client_name=GRAPHQL_CLIENT_NAME)
            self._auth_source = auth_source or "credentials"
            if persist_token and client.token:
                self._persist_token(client.token)
            return self.auth_status()

    async def logout(self, *, clear_persisted_token: bool = True) -> None:
        async with self._lock:
            self._client = None
            self._auth_source = None
            if clear_persisted_token:
                self._clear_persisted_token()

    async def get_accounts(self) -> Dict[str, Any]:
        client = self._require_client()
        return await client.get_accounts()

    async def get_budgets(
        self,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        client = self._require_client()
        kwargs: Dict[str, str] = {}
        if start_date is not None:
            kwargs["start_date"] = start_date.isoformat()
        if end_date is not None:
            kwargs["end_date"] = end_date.isoformat()
        return await client.get_budgets(**kwargs)

    async def get_transaction_categories(self) -> Dict[str, Any]:
        client = self._require_client()
        payload = await client.get_transaction_categories()
        categories = [
            category
            for category in payload.get("categories", [])
            if not category.get("isDisabled")
        ]
        categories.sort(
            key=lambda category: (
                str(category.get("group", {}).get("name") or ""),
                int(category.get("order") or 0),
                str(category.get("name") or ""),
            )
        )
        return {"categories": categories}

    async def get_budget_history(self, *, months: int = 12) -> Dict[str, Any]:
        client = self._require_client()
        total_months = max(months, 2)
        end_month = date.today().replace(day=1)
        start_month = self._shift_month(end_month, -(total_months - 1))
        payload = await client.get_budgets(
            start_date=start_month.isoformat(),
            end_date=end_month.isoformat(),
        )
        return self._normalize_budget_history(
            payload=payload,
            start_month=start_month,
            end_month=end_month,
            months=total_months,
        )

    async def get_transactions_summary(self) -> Dict[str, Any]:
        client = self._require_client()
        return await client.get_transactions_summary()

    async def get_current_month_summary(self) -> Dict[str, Any]:
        client = self._require_client()
        today = date.today()
        start_of_month = today.replace(day=1)

        transactions_payload = await client.get_transactions(
            limit=1,
            offset=0,
            start_date=start_of_month.isoformat(),
            end_date=today.isoformat(),
        )
        transactions = transactions_payload.get("allTransactions", {})

        cashflow_payload = await client.get_cashflow_summary(
            start_date=start_of_month.isoformat(),
            end_date=today.isoformat(),
        )
        cashflow_summary = (
            cashflow_payload.get("summary", [{}])[0].get("summary", {})
            if isinstance(cashflow_payload.get("summary"), list)
            else {}
        )

        return {
            "startDate": start_of_month.isoformat(),
            "endDate": today.isoformat(),
            "summary": {
                "count": transactions.get("totalCount", 0),
                "sumIncome": cashflow_summary.get("sumIncome", 0),
                "sumExpense": cashflow_summary.get("sumExpense", 0),
            },
        }

    async def get_cashflow_history(self, *, months: int = 12) -> Dict[str, Any]:
        client = self._require_client()
        total_months = max(months, 2)
        today = date.today()
        end_month = today.replace(day=1)
        start_month = self._shift_month(end_month, -(total_months - 1))
        month_starts = [
            self._shift_month(start_month, index)
            for index in range(total_months)
        ]

        payloads = await asyncio.gather(
            *[
                client.get_cashflow_summary(
                    start_date=month_start.isoformat(),
                    end_date=(
                        today.isoformat()
                        if month_start == end_month
                        else self._end_of_month(month_start).isoformat()
                    ),
                )
                for month_start in month_starts
            ]
        )

        series: List[Dict[str, Any]] = []
        total_income = 0.0
        total_expense = 0.0

        for month_start, payload in zip(month_starts, payloads):
            summary = (
                payload.get("summary", [{}])[0].get("summary", {})
                if isinstance(payload.get("summary"), list)
                else {}
            )
            income = abs(float(summary.get("sumIncome") or 0))
            expense = abs(float(summary.get("sumExpense") or 0))
            net = income - expense
            flow = income + expense

            total_income += income
            total_expense += expense
            series.append(
                {
                    "month": month_start.isoformat(),
                    "income": income,
                    "expense": expense,
                    "net": net,
                    "flow": flow,
                }
            )

        non_empty_series = [
            point for point in series if point["income"] > 0.01 or point["expense"] > 0.01
        ]
        best_net_month = max(non_empty_series or series, key=lambda point: point["net"], default=None)
        max_income_month = max(
            non_empty_series or series, key=lambda point: point["income"], default=None
        )
        max_expense_month = max(
            non_empty_series or series, key=lambda point: point["expense"], default=None
        )

        return {
            "months": total_months,
            "startMonth": start_month.isoformat(),
            "endMonth": end_month.isoformat(),
            "summary": {
                "totalIncome": total_income,
                "totalExpense": total_expense,
                "totalNet": total_income - total_expense,
                "averageIncome": total_income / total_months,
                "averageExpense": total_expense / total_months,
                "bestNetMonth": best_net_month,
                "maxIncomeMonth": max_income_month,
                "maxExpenseMonth": max_expense_month,
            },
            "series": series,
        }

    async def get_transactions(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: str = "",
        category_ids: Optional[List[str]] = None,
        account_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        client = self._require_client()
        payload = await client.get_transactions(
            limit=limit,
            offset=offset,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            search=search,
            category_ids=category_ids or [],
            account_ids=account_ids or [],
        )
        all_transactions = payload.get("allTransactions", {})
        return {
            "transactions": all_transactions.get("results", []),
            "totalCount": all_transactions.get("totalCount", 0),
        }

    async def get_transaction_details(self, transaction_id: str) -> Dict[str, Any]:
        client = self._require_client()
        return await client.get_transaction_details(transaction_id)

    async def get_net_worth_history(self, *, days: int = 180) -> Dict[str, Any]:
        client = self._require_client()
        accounts_payload = await client.get_accounts()
        accounts = accounts_payload.get("accounts", [])
        tracked_accounts = [
            account
            for account in accounts
            if not account.get("deactivatedAt")
            and account.get("includeInNetWorth", True)
            and account.get("includeBalanceInNetWorth", True)
        ]

        end_day = date.today()
        total_days = max(days, 2)
        start_day = end_day - timedelta(days=total_days - 1)
        dates = [start_day + timedelta(days=index) for index in range(total_days)]

        history_results = await asyncio.gather(
            *(self._load_account_history(client, account) for account in tracked_accounts)
        )

        series = self._build_net_worth_series(dates=dates, histories=history_results)
        latest_point = series[-1] if series else {"netWorth": 0.0, "assets": 0.0, "liabilities": 0.0}
        failed_accounts = [
            item["account"]
            for item in history_results
            if item.get("error")
        ]

        return {
            "startDate": start_day.isoformat(),
            "endDate": end_day.isoformat(),
            "days": total_days,
            "accountsConsidered": len(tracked_accounts) - len(failed_accounts),
            "accountsFailed": failed_accounts,
            "series": series,
            "latestNetWorth": latest_point["netWorth"],
            "latestAssets": latest_point["assets"],
            "latestLiabilities": latest_point["liabilities"],
        }

    async def _login_with_credentials(
        self,
        *,
        client: MonarchMoney,
        email: str,
        password: str,
        mfa_code: Optional[str] = None,
        recovery_code: Optional[str] = None,
        email_otp: Optional[str] = None,
        trusted_device: bool = False,
        mfa_secret_key: Optional[str] = None,
    ) -> None:
        payload = {
            "username": email,
            "password": password,
            "supports_mfa": True,
            "supports_email_otp": True,
            "supports_recaptcha": True,
            "trusted_device": trusted_device,
        }

        if mfa_code:
            payload["totp"] = mfa_code
        elif recovery_code:
            payload["recovery_code"] = recovery_code
        elif email_otp:
            payload["email_otp"] = email_otp
        elif mfa_secret_key:
            payload["totp"] = oathtool.generate_otp(mfa_secret_key)

        async with ClientSession(headers=client._headers) as session:
            async with session.post(MonarchMoneyEndpoints.getLoginEndpoint(), json=payload) as resp:
                status_code = resp.status
                reason = resp.reason
                response = await self._parse_response(resp)

        if status_code == 403 or response.get("error_code") in {"MFA_REQUIRED", "EMAIL_OTP_REQUIRED"}:
            detail = response.get("detail") or self._message_for_error_code(response.get("error_code"))
            raise MFARequiredError(
                detail,
                code=self._challenge_code_for_error(response.get("error_code")),
            )

        if status_code != 200:
            detail = (
                response.get("detail")
                or response.get("error_code")
                or f"HTTP Code {status_code}: {reason}"
            )
            raise LoginFailedException(detail)

        token = response.get("token")
        if not token:
            raise LoginFailedException("Monarch login succeeded but no token was returned.")

        client.set_token(token)
        client._headers["Authorization"] = f"Token {token}"

    async def _load_account_history(
        self,
        client: MonarchMoney,
        account: Dict[str, Any],
    ) -> Dict[str, Any]:
        try:
            history = await client.get_account_history(account["id"])
            return {"account": account, "history": history, "error": None}
        except Exception as exc:
            return {
                "account": {
                    "id": account.get("id"),
                    "displayName": account.get("displayName"),
                },
                "history": [],
                "error": str(exc),
            }

    def _build_net_worth_series(
        self,
        *,
        dates: List[date],
        histories: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        date_labels = [item.isoformat() for item in dates]
        totals = {
            label: {"netWorth": 0.0, "assets": 0.0, "liabilities": 0.0}
            for label in date_labels
        }

        for item in histories:
            account = item["account"]
            history = sorted(
                (
                    (snapshot["date"], float(snapshot.get("signedBalance", 0) or 0))
                    for snapshot in item["history"]
                    if snapshot.get("date")
                ),
                key=lambda snapshot: snapshot[0],
            )

            history_index = 0
            last_balance = 0.0
            for label in date_labels:
                while history_index < len(history) and history[history_index][0] <= label:
                    last_balance = history[history_index][1]
                    history_index += 1

                totals[label]["netWorth"] += last_balance
                if account.get("isAsset", True):
                    totals[label]["assets"] += last_balance
                else:
                    totals[label]["liabilities"] += abs(last_balance)

        return [
            {
                "date": label,
                "netWorth": round(values["netWorth"], 2),
                "assets": round(values["assets"], 2),
                "liabilities": round(values["liabilities"], 2),
            }
            for label, values in totals.items()
        ]

    async def _validate_client_token(self, client: MonarchMoney) -> None:
        try:
            await client.get_accounts()
        except Exception as exc:
            raise LoginError("The saved Monarch token is invalid or expired.") from exc

    def _normalize_budget_history(
        self,
        *,
        payload: Dict[str, Any],
        start_month: date,
        end_month: date,
        months: int,
    ) -> Dict[str, Any]:
        month_keys = [
            self._shift_month(start_month, index).isoformat()
            for index in range(months)
        ]
        budget_data = payload.get("budgetData") or {}
        category_groups = payload.get("categoryGroups") or []
        monthly_amounts_by_category = budget_data.get("monthlyAmountsByCategory") or []

        group_map: Dict[str, Dict[str, Any]] = {}
        category_map: Dict[str, Dict[str, Any]] = {}

        for group in category_groups:
            group_id = group.get("id")
            if not group_id:
                continue

            group_entry = {
                "id": group_id,
                "name": group.get("name") or "Untitled group",
                "type": str(group.get("type") or "").lower(),
                "order": group.get("order") or 0,
                "updatedAt": group.get("updatedAt"),
            }
            group_map[group_id] = group_entry

            for category in group.get("categories") or []:
                category_id = category.get("id")
                if not category_id:
                    continue

                category_group = category.get("group") or {}
                category_map[category_id] = {
                    "id": category_id,
                    "name": category.get("name") or "Untitled category",
                    "icon": category.get("icon"),
                    "order": category.get("order") or 0,
                    "updatedAt": category.get("updatedAt"),
                    "excludeFromBudget": bool(category.get("excludeFromBudget")),
                    "budgetVariability": category.get("budgetVariability"),
                    "group": group_map.get(category_group.get("id"), group_entry),
                }

        categories: List[Dict[str, Any]] = []

        for item in monthly_amounts_by_category:
            category_id = (item.get("category") or {}).get("id")
            category = category_map.get(category_id)
            if not category:
                continue

            group = category.get("group") or {}
            if category.get("excludeFromBudget"):
                continue
            if group.get("type") == "income":
                continue

            month_map = {
                monthly_amount.get("month"): monthly_amount
                for monthly_amount in item.get("monthlyAmounts") or []
                if monthly_amount.get("month")
            }

            series: List[Dict[str, Any]] = []
            total_actual = 0.0
            total_planned = 0.0

            for month_key in month_keys:
                monthly_amount = month_map.get(month_key, {})
                planned_cash_flow = float(monthly_amount.get("plannedCashFlowAmount") or 0)
                planned_set_aside = float(monthly_amount.get("plannedSetAsideAmount") or 0)
                planned = abs(planned_cash_flow + planned_set_aside)
                actual = abs(float(monthly_amount.get("actualAmount") or 0))
                remaining = float(monthly_amount.get("remainingAmount") or 0)
                variance = actual - planned

                total_actual += actual
                total_planned += planned
                series.append(
                    {
                        "month": month_key,
                        "actual": actual,
                        "planned": planned,
                        "remaining": remaining,
                        "variance": variance,
                    }
                )

            if not any(point["actual"] or point["planned"] for point in series):
                continue

            current_month = series[-1]
            planned_for_utilization = current_month["planned"]
            utilization = (
                current_month["actual"] / planned_for_utilization
                if planned_for_utilization > 0
                else None
            )

            categories.append(
                {
                    "id": category["id"],
                    "name": category["name"],
                    "icon": category.get("icon"),
                    "updatedAt": category.get("updatedAt"),
                    "budgetVariability": category.get("budgetVariability"),
                    "group": {
                        "id": group.get("id"),
                        "name": group.get("name"),
                        "type": group.get("type"),
                        "order": group.get("order") or 0,
                    },
                    "series": series,
                    "currentMonth": {
                        **current_month,
                        "utilization": utilization,
                    },
                    "totals": {
                        "actual": total_actual,
                        "planned": total_planned,
                    },
                }
            )

        categories.sort(
            key=lambda category: (
                -(category.get("currentMonth") or {}).get("actual", 0),
                (category.get("group") or {}).get("order", 0),
                category.get("name", "").lower(),
            )
        )

        groups: List[Dict[str, Any]] = []
        for group in sorted(
            group_map.values(),
            key=lambda item: (item.get("order", 0), item.get("name", "").lower()),
        ):
            category_count = sum(
                1
                for category in categories
                if (category.get("group") or {}).get("id") == group.get("id")
            )
            if category_count == 0:
                continue

            groups.append({**group, "categoryCount": category_count})

        current_month_categories = [category["currentMonth"] for category in categories]
        over_plan_count = sum(
            1 for month in current_month_categories if month["variance"] > 0.01
        )
        under_plan_count = sum(
            1 for month in current_month_categories if month["variance"] < -0.01
        )
        planned_current_month = sum(month["planned"] for month in current_month_categories)
        actual_current_month = sum(month["actual"] for month in current_month_categories)

        return {
            "months": months,
            "startMonth": start_month.isoformat(),
            "endMonth": end_month.isoformat(),
            "groups": groups,
            "summary": {
                "categoryCount": len(categories),
                "overPlanCount": over_plan_count,
                "underPlanCount": under_plan_count,
                "plannedCurrentMonth": planned_current_month,
                "actualCurrentMonth": actual_current_month,
                "varianceCurrentMonth": actual_current_month - planned_current_month,
            },
            "categories": categories,
        }

    @staticmethod
    def _shift_month(value: date, delta: int) -> date:
        month_index = value.month - 1 + delta
        year = value.year + month_index // 12
        month = month_index % 12 + 1
        return date(year, month, 1)

    @staticmethod
    def _end_of_month(value: date) -> date:
        return MonarchService._shift_month(value, 1) - timedelta(days=1)

    def _persist_token(self, token: str) -> None:
        path = self._settings.monarch_persisted_token_path
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(f"{path.suffix}.tmp")
        payload = {"token": token}
        temp_path.write_text(json.dumps(payload), encoding="utf-8")
        os.chmod(temp_path, 0o600)
        temp_path.replace(path)

    def _load_persisted_token(self) -> Optional[str]:
        path = self._settings.monarch_persisted_token_path
        if not path.exists():
            return None

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            self._clear_persisted_token()
            return None

        token = payload.get("token")
        return token if isinstance(token, str) and token.strip() else None

    def _clear_persisted_token(self) -> None:
        path = self._settings.monarch_persisted_token_path
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass

    async def _apply_client_metadata(self, client: MonarchMoney, *, client_name: str) -> None:
        client_version = await self._get_client_version()
        client._headers.update(
            {
                "Client-Platform": CLIENT_PLATFORM,
                "Device-UUID": self._device_uuid,
                "Monarch-Client": client_name,
                "Monarch-Client-Version": client_version,
            }
        )

    async def _get_client_version(self) -> str:
        if self._client_version:
            return self._client_version

        url = "https://app.monarch.com"
        try:
            timeout = ClientTimeout(total=self._settings.monarch_timeout)
            async with ClientSession(timeout=timeout) as session:
                async with session.get(url) as resp:
                    html = await resp.text()
            match = re.search(r'SENTRY_RELEASE=\{id:"([^"]+)"\}', html)
            if match:
                self._client_version = match.group(1)
                return self._client_version
        except Exception:
            pass

        self._client_version = DEFAULT_MONARCH_CLIENT_VERSION
        return self._client_version

    def _message_for_error_code(self, error_code: Optional[str]) -> str:
        if error_code == "EMAIL_OTP_REQUIRED":
            return "Monarch requires the email verification code sent to your inbox."
        if error_code == "MFA_REQUIRED":
            return "Monarch requires a one-time MFA code for this login."
        return "Additional authentication is required to continue."

    def _challenge_code_for_error(self, error_code: Optional[str]) -> str:
        if error_code == "EMAIL_OTP_REQUIRED":
            return "email_otp_required"
        if error_code == "MFA_REQUIRED":
            return "mfa_required"
        return "mfa_required"

    def _require_client(self) -> MonarchMoney:
        if self._client is None:
            raise NotAuthenticatedError("Authenticate with Monarch before calling this endpoint.")
        return self._client

    async def _parse_response(self, response: Any) -> Dict[str, Any]:
        try:
            data = await response.json()
            if isinstance(data, dict):
                return data
            return {"detail": str(data)}
        except Exception:
            text = await response.text()
            return {"detail": text.strip() or None}
