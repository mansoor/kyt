"""
Shared fixtures for KYT backend tests.

Tests use httpx.AsyncClient with the FastAPI app directly (no HTTP stack).
Two dependency overrides are applied globally:
  - get_current_user  → returns a fake admin user (skips JWT validation)
  - get_db            → returns a MagicMock that yields empty results for
                        scalars/mappings so all endpoints return 200 with
                        empty payloads without touching PostgreSQL.

To run:
    cd backend
    pytest -q
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Must set env vars before importing app modules that read settings at import time
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost/x")
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-chars-long!")
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key-32-chars-ok!")

from main import app  # noqa: E402 — must come after env vars
from database import get_db  # noqa: E402
from routers.auth import get_current_user  # noqa: E402


# ── Fake user ──────────────────────────────────────────────────────────────────

class FakeUser:
    id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    email = "test@kyt.local"
    is_active = True
    is_superuser = True
    created_at = datetime.now(timezone.utc)
    last_login = datetime.now(timezone.utc)


def _fake_mappings(rows: list[dict] | None = None):
    """Return a mock whose .mappings().all() yields the given rows."""
    rows = rows or []
    m = MagicMock()
    m.mappings.return_value.all.return_value = rows
    # Covers every key read by any router's .mappings().one() call
    m.mappings.return_value.one.return_value = {
        # drives KPIs
        "count": 0, "total_km": 0, "total_min": 0, "total_kwh": 0,
        "avg_wh_km": 0, "best_wh_km": 0, "worst_wh_km": 0, "avg_temp": 0,
        # charges KPIs
        "total_cost": 0, "sessions": 0, "total_kwh_added": 0, "total_kwh_used": 0,
        "avg_kwh": 0, "avg_duration_min": 0, "avg_start_soc": 0,
        "avg_end_soc": 0, "avg_charge_rate_kw": 0,
        # dashboard
        "drives": 0, "distance_km": 0, "energy_consumed_kwh": 0,
        "energy_added_kwh": 0, "drive_time_min": 0, "charges": 0,
        # battery
        "cycles": 0, "n": 0,
        # analytics charging
        "total_kwh": 0,
        # analytics vampire
        "avg_drain_pct_hr": None, "total_drain_pct": 0, "total_parked_hours": 0,
        "idle_periods": 0,
    }
    m.mappings.return_value.one_or_none.return_value = None
    m.scalar_one_or_none.return_value = None
    m.scalar_one.return_value = 0
    m.scalars.return_value.all.return_value = []
    return m


async def _fake_db():
    """Async generator that yields a mock AsyncSession."""
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_fake_mappings())
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    db.delete = AsyncMock()
    yield db


# ── pytest-asyncio config ──────────────────────────────────────────────────────

pytest_plugins = ["pytest_asyncio"]


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


# ── Client fixture ─────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient with both dependency overrides active."""
    app.dependency_overrides[get_current_user] = lambda: FakeUser()
    app.dependency_overrides[get_db] = _fake_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def unauthed_client() -> AsyncGenerator[AsyncClient, None]:
    """Client with no auth override — tests that endpoints require auth."""
    app.dependency_overrides[get_db] = _fake_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
