"""Charges list and detail endpoints."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/charges", tags=["charges"])


@router.get("")
async def list_charges(
    car_id: int | None = None,
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort: str = Query("start_date"),
    order: str = Query("desc"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since = from_date or (now - timedelta(days=30))
    until = to_date or now

    valid_sorts = {"start_date", "charge_energy_added", "duration_min", "cost"}
    sort_col = sort if sort in valid_sorts else "start_date"
    order_dir = "DESC" if order.lower() == "desc" else "ASC"
    car_filter = f"cp.car_id = {car_id}" if car_id else "1=1"

    kpi = await db.execute(
        text(f"""
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM(charge_energy_added), 0) AS total_kwh_added,
                COALESCE(SUM(charge_energy_used), 0) AS total_kwh_used,
                COALESCE(SUM(cost), 0) AS total_cost,
                COALESCE(AVG(duration_min), 0) AS avg_duration_min
            FROM charging_processes cp
            WHERE {car_filter}
              AND cp.start_date BETWEEN :since AND :until
              AND cp.end_date IS NOT NULL
        """),
        {"since": since, "until": until},
    )
    kpi_row = kpi.mappings().one()
    total = int(kpi_row["count"])
    offset = (page - 1) * page_size

    rows = await db.execute(
        text(f"""
            SELECT
                cp.id, cp.car_id, cp.start_date, cp.end_date,
                cp.charge_energy_added, cp.charge_energy_used,
                cp.start_battery_level, cp.end_battery_level,
                cp.duration_min, cp.outside_temp_avg, cp.cost,
                cp.start_ideal_range_km, cp.end_ideal_range_km,
                g.name AS geofence_name,
                a.display_name AS address
            FROM charging_processes cp
            LEFT JOIN geofences g ON g.id = cp.geofence_id
            LEFT JOIN addresses a ON a.id = cp.address_id
            WHERE {car_filter}
              AND cp.start_date BETWEEN :since AND :until
              AND cp.end_date IS NOT NULL
            ORDER BY cp.{sort_col} {order_dir}
            LIMIT :limit OFFSET :offset
        """),
        {"since": since, "until": until, "limit": page_size, "offset": offset},
    )

    charges = []
    for r in rows.mappings().all():
        added = float(r["charge_energy_added"]) if r["charge_energy_added"] else 0
        used = float(r["charge_energy_used"]) if r["charge_energy_used"] else 0
        range_gained = None
        if r["start_ideal_range_km"] and r["end_ideal_range_km"]:
            range_gained = round(float(r["end_ideal_range_km"]) - float(r["start_ideal_range_km"]), 1)
        charges.append({
            "id": r["id"],
            "car_id": r["car_id"],
            "start_date": r["start_date"].isoformat(),
            "end_date": r["end_date"].isoformat() if r["end_date"] else None,
            "location": r["geofence_name"] or r["address"] or "Unknown",
            "energy_added_kwh": round(added, 2),
            "energy_used_kwh": round(used, 2),
            "start_battery": r["start_battery_level"],
            "end_battery": r["end_battery_level"],
            "duration_min": r["duration_min"],
            "outside_temp": r["outside_temp_avg"],
            "cost": round(float(r["cost"]), 2) if r["cost"] else None,
            "range_gained_km": range_gained,
            "efficiency_pct": round(used / added * 100, 1) if added > 0 else None,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "kpis": {
            "total_charges": total,
            "total_kwh_added": round(float(kpi_row["total_kwh_added"]), 2),
            "total_kwh_used": round(float(kpi_row["total_kwh_used"]), 2),
            "total_cost": round(float(kpi_row["total_cost"]), 2),
            "avg_duration_min": round(float(kpi_row["avg_duration_min"]), 0),
        },
        "charges": charges,
    }


@router.get("/export")
async def export_charges(
    car_id: int | None = None,
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since = from_date or (now - timedelta(days=30))
    until = to_date or now
    car_filter = f"cp.car_id = {car_id}" if car_id else "1=1"

    rows = await db.execute(
        text(f"""
            SELECT cp.id, cp.start_date, cp.end_date,
                   cp.charge_energy_added, cp.charge_energy_used,
                   cp.start_battery_level, cp.end_battery_level,
                   cp.duration_min, cp.cost,
                   g.name AS geofence_name, a.display_name AS address
            FROM charging_processes cp
            LEFT JOIN geofences g ON g.id = cp.geofence_id
            LEFT JOIN addresses a ON a.id = cp.address_id
            WHERE {car_filter}
              AND cp.start_date BETWEEN :since AND :until
              AND cp.end_date IS NOT NULL
            ORDER BY cp.start_date DESC
        """),
        {"since": since, "until": until},
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "start_date", "end_date", "location",
        "energy_added_kwh", "energy_used_kwh",
        "start_battery_pct", "end_battery_pct",
        "duration_min", "cost",
    ])
    for r in rows.mappings().all():
        writer.writerow([
            r["id"], r["start_date"], r["end_date"],
            r["geofence_name"] or r["address"] or "",
            round(float(r["charge_energy_added"]), 2) if r["charge_energy_added"] else "",
            round(float(r["charge_energy_used"]), 2) if r["charge_energy_used"] else "",
            r["start_battery_level"], r["end_battery_level"],
            r["duration_min"],
            round(float(r["cost"]), 2) if r["cost"] else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=charges.csv"},
    )


@router.get("/{charge_id}")
async def get_charge(
    charge_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.execute(
        text("""
            SELECT cp.*,
                   g.name AS geofence_name, g.latitude AS geo_lat, g.longitude AS geo_lng,
                   a.display_name AS address,
                   c.name AS car_name
            FROM charging_processes cp
            LEFT JOIN geofences g ON g.id = cp.geofence_id
            LEFT JOIN addresses a ON a.id = cp.address_id
            LEFT JOIN cars c ON c.id = cp.car_id
            WHERE cp.id = :id
        """),
        {"id": charge_id},
    )
    r = row.mappings().one_or_none()
    if not r:
        raise HTTPException(404, "Charge session not found")

    # Determine location lat/lng (from geofence or position)
    lat, lng = r["geo_lat"], r["geo_lng"]
    if lat is None and r["position_id"]:
        pos_row = await db.execute(
            text("SELECT latitude, longitude FROM positions WHERE id = :id"),
            {"id": r["position_id"]},
        )
        pr = pos_row.mappings().one_or_none()
        if pr:
            lat, lng = pr["latitude"], pr["longitude"]

    return {
        "id": r["id"],
        "car_id": r["car_id"],
        "car_name": r["car_name"],
        "start_date": r["start_date"].isoformat(),
        "end_date": r["end_date"].isoformat() if r["end_date"] else None,
        "location": r["geofence_name"] or r["address"] or "Unknown",
        "latitude": float(lat) if lat else None,
        "longitude": float(lng) if lng else None,
        "energy_added_kwh": round(float(r["charge_energy_added"]), 2) if r["charge_energy_added"] else None,
        "energy_used_kwh": round(float(r["charge_energy_used"]), 2) if r["charge_energy_used"] else None,
        "start_battery": r["start_battery_level"],
        "end_battery": r["end_battery_level"],
        "start_range_km": round(float(r["start_ideal_range_km"]), 1) if r["start_ideal_range_km"] else None,
        "end_range_km": round(float(r["end_ideal_range_km"]), 1) if r["end_ideal_range_km"] else None,
        "duration_min": r["duration_min"],
        "outside_temp_avg": r["outside_temp_avg"],
        "cost": round(float(r["cost"]), 2) if r["cost"] else None,
        "charging_status": r["charging_status"],
    }


@router.get("/{charge_id}/readings")
async def get_charge_readings(
    charge_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Time-series readings during a charge session."""
    rows = await db.execute(
        text("""
            SELECT date, battery_level, charge_energy_added,
                   charger_power, charger_voltage, charger_actual_current,
                   outside_temp, usable_battery_level
            FROM charges
            WHERE charging_process_id = :id
            ORDER BY date ASC
        """),
        {"id": charge_id},
    )
    readings = [
        {
            "t": r["date"].isoformat(),
            "battery": r["battery_level"],
            "energy_added": float(r["charge_energy_added"]) if r["charge_energy_added"] else None,
            "power_kw": r["charger_power"],
            "voltage": r["charger_voltage"],
            "current": r["charger_actual_current"],
            "outside_temp": r["outside_temp"],
        }
        for r in rows.mappings().all()
    ]

    # Build charge curve: SoC% → peak power at that SoC
    curve: dict[int, float] = {}
    for pt in readings:
        soc = pt["battery"]
        pwr = pt["power_kw"]
        if soc is not None and pwr is not None:
            curve[soc] = max(curve.get(soc, 0), pwr)
    charge_curve = [{"soc": k, "power_kw": v} for k, v in sorted(curve.items())]

    return {"charge_id": charge_id, "readings": readings, "charge_curve": charge_curve}
