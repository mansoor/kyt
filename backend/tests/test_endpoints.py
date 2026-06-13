"""
Tests that every protected endpoint:
  - Returns 401 without authentication
  - Returns 200 (or 204) with authentication and empty data
  - Returns 422 on invalid query params
"""
import pytest
from httpx import AsyncClient


# ── Helper ─────────────────────────────────────────────────────────────────────

def _assert_paginated(body: dict):
    """All paginated list endpoints share this shape."""
    assert "total" in body
    assert "page" in body
    assert "page_size" in body


# ── Dashboard ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_summary_auth(client: AsyncClient):
    r = await client.get("/api/dashboard/summary")
    assert r.status_code == 200
    body = r.json()
    assert "vehicles" in body
    assert "kpis" in body
    assert "battery_history" in body
    assert "recent_activity" in body


@pytest.mark.asyncio
async def test_dashboard_summary_unauth(unauthed_client: AsyncClient):
    r = await unauthed_client.get("/api/dashboard/summary")
    assert r.status_code == 401


# ── Drives ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_drives_list(client: AsyncClient):
    r = await client.get("/api/drives")
    assert r.status_code == 200
    body = r.json()
    _assert_paginated(body)
    assert "drives" in body
    assert "kpis" in body


@pytest.mark.asyncio
async def test_drives_list_unauth(unauthed_client: AsyncClient):
    r = await unauthed_client.get("/api/drives")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_drives_list_invalid_page(client: AsyncClient):
    r = await client.get("/api/drives?page=0")  # page must be ≥ 1
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_drive_detail_not_found(client: AsyncClient):
    r = await client.get("/api/drives/99999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_drive_positions_not_found(client: AsyncClient):
    r = await client.get("/api/drives/99999/positions")
    # Returns empty list (no 404 — drive may just have no positions)
    assert r.status_code == 200
    assert r.json()["positions"] == []


# ── Charges ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_charges_list(client: AsyncClient):
    r = await client.get("/api/charges")
    assert r.status_code == 200
    body = r.json()
    _assert_paginated(body)
    assert "charges" in body


@pytest.mark.asyncio
async def test_charges_list_unauth(unauthed_client: AsyncClient):
    r = await unauthed_client.get("/api/charges")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_charge_detail_not_found(client: AsyncClient):
    r = await client.get("/api/charges/99999")
    assert r.status_code == 404


# ── Analytics ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analytics_efficiency(client: AsyncClient):
    r = await client.get("/api/analytics/efficiency")
    assert r.status_code == 200
    body = r.json()
    assert "kpis" in body
    assert "by_day" in body
    assert "by_temp" in body
    assert "by_speed" in body


@pytest.mark.asyncio
async def test_analytics_charging(client: AsyncClient):
    r = await client.get("/api/analytics/charging")
    assert r.status_code == 200
    body = r.json()
    assert "kpis" in body
    assert "by_month" in body
    assert "by_hour" in body
    assert len(body["by_hour"]) == 24  # always 24 hours


@pytest.mark.asyncio
async def test_analytics_vampire_drain(client: AsyncClient):
    r = await client.get("/api/analytics/vampire-drain")
    assert r.status_code == 200
    body = r.json()
    assert "kpis" in body
    assert "by_day" in body


@pytest.mark.asyncio
async def test_analytics_timeline(client: AsyncClient):
    r = await client.get("/api/analytics/timeline")
    assert r.status_code == 200
    body = r.json()
    assert "days" in body
    # 365 days + today = 366 entries
    assert len(body["days"]) >= 365


@pytest.mark.asyncio
async def test_analytics_efficiency_days_validation(client: AsyncClient):
    r = await client.get("/api/analytics/efficiency?days=6")   # min is 7
    assert r.status_code == 422
    r = await client.get("/api/analytics/efficiency?days=400") # max is 365
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_analytics_unauth(unauthed_client: AsyncClient):
    for path in ["/api/analytics/efficiency", "/api/analytics/charging",
                 "/api/analytics/vampire-drain", "/api/analytics/timeline"]:
        r = await unauthed_client.get(path)
        assert r.status_code == 401, f"Expected 401 for {path}"


# ── Vehicle endpoints ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_battery_health(client: AsyncClient):
    r = await client.get("/api/battery/health")
    assert r.status_code == 200
    body = r.json()
    assert "weekly" in body
    assert "degradation" in body
    assert "estimated_charge_cycles" in body


@pytest.mark.asyncio
async def test_locations(client: AsyncClient):
    r = await client.get("/api/locations")
    assert r.status_code == 200
    body = r.json()
    assert "drives" in body
    assert "charges" in body


@pytest.mark.asyncio
async def test_software_updates(client: AsyncClient):
    r = await client.get("/api/updates")
    assert r.status_code == 200
    body = r.json()
    assert "updates" in body
    assert "total" in body


@pytest.mark.asyncio
async def test_geofences_list(client: AsyncClient):
    r = await client.get("/api/geofences")
    assert r.status_code == 200
    assert "geofences" in r.json()


@pytest.mark.asyncio
async def test_geofence_create_validation(client: AsyncClient):
    # Missing required fields
    r = await client.post("/api/geofences", json={"name": "Test"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_geofence_delete_not_found(client: AsyncClient):
    r = await client.delete("/api/geofences/99999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_vehicle_endpoints_unauth(unauthed_client: AsyncClient):
    for path in ["/api/battery/health", "/api/locations", "/api/updates", "/api/geofences"]:
        r = await unauthed_client.get(path)
        assert r.status_code == 401, f"Expected 401 for {path}"


# ── Tesla OAuth ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tesla_auth_url(client: AsyncClient):
    r = await client.get("/api/tesla/auth/url")
    assert r.status_code == 200
    body = r.json()
    assert "url" in body
    assert "configured" in body
    assert body["configured"] is False  # no TESLA_CLIENT_ID in test env


@pytest.mark.asyncio
async def test_tesla_vehicles(client: AsyncClient):
    r = await client.get("/api/tesla/vehicles")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
