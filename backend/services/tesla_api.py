"""Async Tesla Fleet API client."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("teslamate.tesla_api")

FLEET_BASE = "https://fleet-api.prd.na.vn.cloud.tesla.com/api/1"


class TeslaAPIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class TeslaAPIClient:
    def __init__(self, access_token: str):
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def _get(self, path: str) -> Any:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{FLEET_BASE}{path}", headers=self._headers)
            if resp.status_code == 408:
                raise TeslaAPIError(408, "Vehicle asleep or unreachable")
            resp.raise_for_status()
            return resp.json()

    async def _post(self, path: str, body: dict | None = None) -> Any:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{FLEET_BASE}{path}", headers=self._headers, json=body or {})
            resp.raise_for_status()
            return resp.json()

    async def list_vehicles(self) -> list[dict]:
        data = await self._get("/vehicles")
        return data.get("response", [])

    async def wake_up(self, vehicle_id: int) -> dict:
        data = await self._post(f"/vehicles/{vehicle_id}/wake_up")
        return data.get("response", {})

    async def vehicle_data(self, vehicle_id: int) -> dict:
        endpoints = "charge_state;climate_state;drive_state;vehicle_state;vehicle_config"
        data = await self._get(f"/vehicles/{vehicle_id}/vehicle_data?endpoints={endpoints}")
        return data.get("response", {})

    async def get_state(self, vehicle_id: int) -> str:
        """Return vehicle state string (online/asleep/offline) without waking."""
        try:
            data = await self._get(f"/vehicles/{vehicle_id}")
            return data.get("response", {}).get("state", "unknown")
        except TeslaAPIError:
            return "unknown"
