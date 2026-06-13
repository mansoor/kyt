"""Vehicle-specific endpoints: battery health, software updates, locations."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.geofence import Geofence
from routers.auth import get_current_user

router = APIRouter(tags=["vehicle"])


# ── Battery Health ─────────────────────────────────────────────────────────────

@router.get("/battery/health")
async def battery_health(
    car_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Estimate battery degradation by tracking maximum observed rated range
    at high SoC (≥90%) over time.
    """
    car_filter = f"p.car_id = {car_id}" if car_id else "1=1"

    # Daily max rated range at high SoC — proxy for battery capacity
    rows = await db.execute(
        text(f"""
            SELECT
                date_trunc('week', p.date) AS week,
                MAX(p.rated_battery_range_km) AS max_rated_km,
                MAX(p.ideal_battery_range_km) AS max_ideal_km,
                MAX(p.battery_level) AS max_soc,
                COUNT(*) AS samples
            FROM positions p
            WHERE {car_filter}
              AND p.battery_level >= 90
              AND p.rated_battery_range_km IS NOT NULL
              AND p.rated_battery_range_km > 50
            GROUP BY 1
            ORDER BY 1
        """),
    )
    weekly = [
        {
            "week": row["week"].date().isoformat(),
            "max_rated_km": round(float(row["max_rated_km"]), 1),
            "max_ideal_km": round(float(row["max_ideal_km"]), 1) if row["max_ideal_km"] else None,
            "samples": row["samples"],
        }
        for row in rows.mappings().all()
    ]

    # Estimate full-charge range (scale max_rated by 100/max_soc seen that week)
    for w in weekly:
        w["est_full_range_km"] = w["max_rated_km"]

    # Degradation: compare oldest vs newest week
    degradation = None
    if len(weekly) >= 2:
        first_range = weekly[0]["max_rated_km"]
        last_range = weekly[-1]["max_rated_km"]
        peak = max(w["max_rated_km"] for w in weekly)
        degradation = {
            "peak_km": peak,
            "current_km": last_range,
            "lost_km": round(peak - last_range, 1),
            "pct_retained": round(last_range / peak * 100, 1) if peak > 0 else 100.0,
        }

    # Charge cycle count proxy: count charging sessions that added >10 kWh
    cycles_row = await db.execute(
        text(f"""
            SELECT COUNT(*) AS cycles
            FROM charging_processes cp
            WHERE {car_filter.replace('p.car_id', 'cp.car_id')}
              AND charge_energy_added > 10
        """),
    )
    cycles = int(cycles_row.scalar_one())

    return {
        "weekly": weekly,
        "degradation": degradation,
        "estimated_charge_cycles": cycles,
    }


# ── Locations ──────────────────────────────────────────────────────────────────

@router.get("/locations")
async def locations(
    car_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All unique drive start/end and charge locations."""
    car_filter = f"car_id = {car_id}" if car_id else "1=1"

    # Drive endpoints from positions (first/last of each drive)
    drive_pts = await db.execute(
        text(f"""
            SELECT
                d.id AS drive_id,
                sp.latitude AS start_lat, sp.longitude AS start_lng,
                ep.latitude AS end_lat, ep.longitude AS end_lng,
                d.distance, d.start_date
            FROM drives d
            JOIN positions sp ON sp.drive_id = d.id AND sp.date = (
                SELECT MIN(date) FROM positions WHERE drive_id = d.id
            )
            JOIN positions ep ON ep.drive_id = d.id AND ep.date = (
                SELECT MAX(date) FROM positions WHERE drive_id = d.id
            )
            WHERE {car_filter.replace('car_id', 'd.car_id')}
              AND d.end_date IS NOT NULL
            ORDER BY d.start_date DESC
            LIMIT 1000
        """),
    )
    drives = [
        {
            "type": "drive",
            "drive_id": r["drive_id"],
            "start": {"lat": r["start_lat"], "lng": r["start_lng"]},
            "end": {"lat": r["end_lat"], "lng": r["end_lng"]},
            "distance_km": round(float(r["distance"]), 1) if r["distance"] else None,
            "date": r["start_date"].isoformat(),
        }
        for r in drive_pts.mappings().all()
    ]

    # Charge locations — lat/lng from first position during each session
    charge_pts = await db.execute(
        text(f"""
            SELECT
                cp.id AS charge_id,
                (SELECT p.latitude FROM positions p
                 WHERE p.car_id = cp.car_id
                   AND p.date BETWEEN cp.start_date AND COALESCE(cp.end_date, NOW())
                 ORDER BY p.date ASC LIMIT 1) AS latitude,
                (SELECT p.longitude FROM positions p
                 WHERE p.car_id = cp.car_id
                   AND p.date BETWEEN cp.start_date AND COALESCE(cp.end_date, NOW())
                 ORDER BY p.date ASC LIMIT 1) AS longitude,
                cp.charge_energy_added, cp.start_date,
                a.display_name AS address
            FROM charging_processes cp
            LEFT JOIN addresses a ON a.id = cp.address_id
            WHERE {car_filter.replace('car_id', 'cp.car_id')}
              AND cp.end_date IS NOT NULL
            ORDER BY cp.start_date DESC
            LIMIT 500
        """),
    )
    charges = [
        {
            "type": "charge",
            "charge_id": r["charge_id"],
            "lat": r["latitude"],
            "lng": r["longitude"],
            "energy_kwh": round(float(r["charge_energy_added"]), 2) if r["charge_energy_added"] else None,
            "date": r["start_date"].isoformat(),
            "address": r["address"],
        }
        for r in charge_pts.mappings().all()
        if r["latitude"] is not None
    ]

    return {"drives": drives, "charges": charges}


# ── Software Updates ───────────────────────────────────────────────────────────

@router.get("/updates")
async def software_updates(
    car_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    car_filter = f"u.car_id = {car_id}" if car_id else "1=1"

    rows = await db.execute(
        text(f"""
            SELECT
                u.id, u.car_id, u.version,
                u.start_date, u.end_date,
                EXTRACT(EPOCH FROM (u.end_date - u.start_date)) / 60 AS duration_min,
                c.name AS car_name
            FROM updates u
            LEFT JOIN cars c ON c.id = u.car_id
            WHERE {car_filter}
            ORDER BY u.start_date DESC
        """),
    )
    updates = [
        {
            "id": r["id"],
            "car_id": r["car_id"],
            "car_name": r["car_name"],
            "version": r["version"],
            "start_date": r["start_date"].isoformat(),
            "end_date": r["end_date"].isoformat() if r["end_date"] else None,
            "duration_min": round(float(r["duration_min"]), 1) if r["duration_min"] else None,
        }
        for r in rows.mappings().all()
    ]
    return {"updates": updates, "total": len(updates)}


# ── Geofences ─────────────────────────────────────────────────────────────────

class GeofenceCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    radius: float = 20.0
    cost_per_unit: float | None = None
    billing_type: str | None = None
    session_fee: float | None = None


class GeofenceUpdate(BaseModel):
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    radius: float | None = None
    cost_per_unit: float | None = None
    billing_type: str | None = None
    session_fee: float | None = None


@router.get("/geofences")
async def list_geofences(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Geofence).order_by(Geofence.name))
    fences = result.scalars().all()
    return {
        "geofences": [
            {
                "id": f.id,
                "name": f.name,
                "latitude": f.latitude,
                "longitude": f.longitude,
                "radius": f.radius,
                "cost_per_unit": f.cost_per_unit,
                "billing_type": f.billing_type,
                "session_fee": f.session_fee,
            }
            for f in fences
        ]
    }


@router.post("/geofences", status_code=201)
async def create_geofence(
    body: GeofenceCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fence = Geofence(
        name=body.name,
        latitude=body.latitude,
        longitude=body.longitude,
        radius=body.radius,
        cost_per_unit=body.cost_per_unit,
        billing_type=body.billing_type,
        session_fee=body.session_fee,
    )
    db.add(fence)
    await db.commit()
    await db.refresh(fence)
    return {"id": fence.id, "name": fence.name}


@router.put("/geofences/{fence_id}")
async def update_geofence(
    fence_id: int,
    body: GeofenceUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Geofence).where(Geofence.id == fence_id))
    fence = result.scalar_one_or_none()
    if not fence:
        raise HTTPException(404, "Geofence not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(fence, field, value)
    await db.commit()
    await db.refresh(fence)
    return {"id": fence.id, "name": fence.name}


@router.delete("/geofences/{fence_id}", status_code=204)
async def delete_geofence(
    fence_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Geofence).where(Geofence.id == fence_id))
    fence = result.scalar_one_or_none()
    if not fence:
        raise HTTPException(404, "Geofence not found")
    await db.delete(fence)
    await db.commit()
