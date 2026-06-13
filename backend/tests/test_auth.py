"""Tests for authentication endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient):
    r = await client.get("/api/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "test@kyt.local"
    assert body["is_superuser"] is True


@pytest.mark.asyncio
async def test_me_requires_auth(unauthed_client: AsyncClient):
    r = await unauthed_client.get("/api/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    r = await client.delete("/api/auth/logout")
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_login_wrong_credentials(client: AsyncClient):
    # With mock DB, no user will be found — expect 401
    r = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpass",
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_missing_fields(client: AsyncClient):
    r = await client.post("/api/auth/login", json={"email": "x@x.com"})
    assert r.status_code == 422  # missing password


@pytest.mark.asyncio
async def test_public_charge_level(client: AsyncClient):
    r = await client.get("/api/public/charge-level")
    assert r.status_code == 200
    assert "vehicles" in r.json()
