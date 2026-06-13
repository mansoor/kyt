"""Drives list and detail endpoints."""
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

router = APIRouter(prefix="/drives", tags=["drives"])

# Map sort param → actual quoted SQL column
_SORT_COLS = {
    "start_date": "d.start_date",
    "distance": "d.distance",
    "duration_min": "d.duration_min",
    "consumption": 'd."consumption_kWh"',
    "speed_max": "d.speed_max",
}


@router.get("")
async def list_drives(
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

    sort_col = _SORT_COLS.get(sort, "d.start_date")
    order_dir = "DESC" if order.lower() == "desc" else "ASC"
    car_filter = f"d.car_id = {car_id}" if car_id else "1=1"

    kpi = await db.execute(
        text(f"""
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM(d.distance), 0) AS total_km,
                COALESCE(SUM(d.duration_min), 0) AS total_min,
                COALESCE(SUM(d."consumption_kWh"), 0) AS total_kwh,
                COALESCE(AVG(
                    CASE WHEN d.distance > 0 THEN d."consumption_kWh" / d.distance * 1000 END
                ), 0) AS avg_wh_km
            FROM drives d
            WHERE {car_filter}
              AND d.start_date BETWEEN :since AND :until
              AND d.end_date IS NOT NULL
        """),
        {"since": since, "until": until},
    )
    kpi_row = kpi.mappings().one()

    total = int(kpi_row["count"])
    offset = (page - 1) * page_size

    rows = await db.execute(
        text(f"""
            SELECT
                d.id, d.car_id, d.start_date, d.end_date,
                d.distance, d.duration_min, d.speed_max,
                d."consumption_kWh" AS consumption_kwh,
                d.start_ideal_range_km, d.end_ideal_range_km,
                d.outside_temp_avg,
                sa.display_name AS start_address,
                ea.display_name AS end_address
            FROM drives d
            LEFT JOIN addresses sa ON sa.id = d.start_address_id
            LEFT JOIN addresses ea ON ea.id = d.end_address_id
            WHERE {car_filter}
              AND d.start_date BETWEEN :since AND :until
              AND d.end_date IS NOT NULL
            ORDER BY {sort_col} {order_dir}
            LIMIT :limit OFFSET :offset
        """),
        {"since": since, "until": until, "limit": page_size, "offset": offset},
    )

    drives = [
        {
            "id": r["id"],
            "car_id": r["car_id"],
            "start_date": r["start_date"].isoformat(),
            "end_date": r["end_date"].isoformat() if r["end_date"] else None,
            "distance_km": round(float(r["distance"]), 2) if r["distance"] else None,
            "duration_min": r["duration_min"],
            "speed_max_kmh": r["speed_max"],
            "consumption_kwh": round(float(r["consumption_kwh"]), 3) if r["consumption_kwh"] else None,
            "start_range_km": round(float(r["start_ideal_range_km"]), 1) if r["start_ideal_range_km"] else None,
            "end_range_km": round(float(r["end_ideal_range_km"]), 1) if r["end_ideal_range_km"] else None,
            "outside_temp_avg": r["outside_temp_avg"],
            "start_address": r["start_address"],
            "end_address": r["end_address"],
        }
        for r in rows.mappings().all()
    ]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "kpis": {
            "total_drives": total,
            "total_km": round(float(kpi_row["total_km"]), 1),
            "total_min": int(kpi_row["total_min"]),
            "total_kwh": round(float(kpi_row["total_kwh"]), 2),
            "avg_consumption_wh_km": round(float(kpi_row["avg_wh_km"]), 1),
        },
        "drives": drives,
    }


@router.get("/export")
async def export_drives(
    car_id: int | None = None,
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since = from_date or (now - timedelta(days=30))
    until = to_date or now
    car_filter = f"d.car_id = {car_id}" if car_id else "1=1"

    rows = await db.execute(
        text(f"""
            SELECT d.id, d.start_date, d.end_date, d.distance,
                   d.duration_min, d.speed_max,
                   d."consumption_kWh" AS consumption_kwh,
                   d.outside_temp_avg,
                   d.start_ideal_range_km, d.end_ideal_range_km,
                   sa.display_name AS start_address, ea.display_name AS end_address
            FROM drives d
            LEFT JOIN addresses sa ON sa.id = d.start_address_id
            LEFT JOIN addresses ea ON ea.id = d.end_address_id
            WHERE {car_filter}
              AND d.start_date BETWEEN :since AND :until
              AND d.end_date IS NOT NULL
            ORDER BY d.start_date DESC
        """),
        {"since": since, "until": until},
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "start_date", "end_date", "distance_km", "duration_min",
        "speed_max_kmh", "consumption_kwh", "outside_temp_avg",
        "start_range_km", "end_range_km", "start_address", "end_address",
    ])
    for r in rows.mappings().all():
        writer.writerow([
            r["id"], r["start_date"], r["end_date"],
            round(float(r["distance"]), 2) if r["distance"] else "",
            r["duration_min"], r["speed_max"],
            round(float(r["consumption_kwh"]), 3) if r["consumption_kwh"] else "",
            r["outside_temp_avg"],
            round(float(r["start_ideal_range_km"]), 1) if r["start_ideal_range_km"] else "",
            round(float(r["end_ideal_range_km"]), 1) if r["end_ideal_range_km"] else "",
            r["start_address"] or "", r["end_address"] or "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=drives.csv"},
    )


@router.get("/{drive_id}")
async def get_drive(
    drive_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.execute(
        text("""
            SELECT d.id, d.car_id, d.start_date, d.end_date,
                   d.distance, d.duration_min, d.speed_max,
                   d.power_max, d.power_min,
                   d."consumption_kWh" AS consumption_kwh,
                   d.start_ideal_range_km, d.end_ideal_range_km,
                   d.outside_temp_avg,
                   sa.display_name AS start_address, ea.display_name AS end_address,
                   c.name AS car_name, c.model AS car_model
            FROM drives d
            LEFT JOIN addresses sa ON sa.id = d.start_address_id
            LEFT JOIN addresses ea ON ea.id = d.end_address_id
            LEFT JOIN cars c ON c.id = d.car_id
            WHERE d.id = :id
        """),
        {"id": drive_id},
    )
    r = row.mappings().one_or_none()
    if not r:
        raise HTTPException(404, "Drive not found")

    return {
        "id": r["id"],
        "car_id": r["car_id"],
        "car_name": r["car_name"],
        "car_model": r["car_model"],
        "start_date": r["start_date"].isoformat(),
        "end_date": r["end_date"].isoformat() if r["end_date"] else None,
        "distance_km": round(float(r["distance"]), 2) if r["distance"] else None,
        "duration_min": r["duration_min"],
        "speed_max_kmh": r["speed_max"],
        "power_max_kw": r["power_max"],
        "power_min_kw": r["power_min"],
        "consumption_kwh": round(float(r["consumption_kwh"]), 3) if r["consumption_kwh"] else None,
        "start_range_km": round(float(r["start_ideal_range_km"]), 1) if r["start_ideal_range_km"] else None,
        "end_range_km": round(float(r["end_ideal_range_km"]), 1) if r["end_ideal_range_km"] else None,
        "outside_temp_avg": r["outside_temp_avg"],
        "start_address": r["start_address"],
        "end_address": r["end_address"],
    }


@router.get("/{drive_id}/positions")
async def get_drive_positions(
    drive_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return GPS positions for map rendering (downsampled to ≤500 points)."""
    rows = await db.execute(
        text("""
            SELECT date, latitude, longitude, speed, power, battery_level,
                   elevation, outside_temp, inside_temp
            FROM positions
            WHERE drive_id = :drive_id
            ORDER BY date ASC
        """),
        {"drive_id": drive_id},
    )
    positions = [
        {
            "t": r["date"].isoformat(),
            "lat": r["latitude"],
            "lng": r["longitude"],
            "speed": r["speed"],
            "power": r["power"],
            "battery": r["battery_level"],
            "elevation": r["elevation"],
            "outside_temp": r["outside_temp"],
            "inside_temp": r["inside_temp"],
        }
        for r in rows.mappings().all()
    ]

    if len(positions) > 500:
        step = len(positions) // 500
        positions = positions[::step]

    return {"drive_id": drive_id, "positions": positions}
