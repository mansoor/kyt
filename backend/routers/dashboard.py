"""Dashboard overview endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.car import Car
from models.charging_process import ChargingProcess
from models.drive import Drive
from models.state import State
from routers.auth import get_current_user
from services.poller import poller

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(
    car_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    thirty_ago = now - timedelta(days=30)

    # Vehicles
    cars_result = await db.execute(select(Car))
    cars = cars_result.scalars().all()
    poller_status = {s["car_id"]: s for s in poller.get_status()}

    vehicle_cards = [
        {
            "id": c.id,
            "name": c.name or c.vin or f"Car {c.id}",
            "model": c.model or c.marketing_name,
            "vin": c.vin,
            "state": poller_status.get(c.id, {}).get("state", "unknown"),
            "battery_level": poller_status.get(c.id, {}).get("battery_level"),
            "latitude": poller_status.get(c.id, {}).get("latitude"),
            "longitude": poller_status.get(c.id, {}).get("longitude"),
        }
        for c in cars
    ]

    # 7-day KPIs — scoped to car_id if provided, else all
    car_filter = f"car_id = {car_id}" if car_id else "1=1"

    kpi_drives = await db.execute(
        text(f"""
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM(distance), 0) AS total_km,
                COALESCE(SUM(duration_min), 0) AS total_min,
                COALESCE(SUM("consumption_kWh"), 0) AS total_kwh
            FROM drives
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
        """),
        {"since": week_ago},
    )
    dr = kpi_drives.mappings().one()

    kpi_charges = await db.execute(
        text(f"""
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM(charge_energy_added), 0) AS total_kwh,
                COALESCE(SUM(cost), 0) AS total_cost
            FROM charging_processes
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
        """),
        {"since": week_ago},
    )
    cr = kpi_charges.mappings().one()

    kpis = {
        "drives": int(dr["count"]),
        "distance_km": round(float(dr["total_km"]), 1),
        "drive_time_min": int(dr["total_min"]),
        "energy_consumed_kwh": round(float(dr["total_kwh"]), 2),
        "charges": int(cr["count"]),
        "energy_added_kwh": round(float(cr["total_kwh"]), 2),
        "total_cost": round(float(cr["total_cost"]), 2),
    }

    # Battery level history (last 30 days) — daily min/max
    batt_rows = await db.execute(
        text(f"""
            SELECT
                date_trunc('day', date) AS day,
                MIN(battery_level) AS min_batt,
                MAX(battery_level) AS max_batt,
                AVG(battery_level) AS avg_batt
            FROM positions
            WHERE {car_filter.replace('car_id', 'positions.car_id')}
              AND date >= :since
              AND battery_level IS NOT NULL
            GROUP BY 1
            ORDER BY 1
        """),
        {"since": thirty_ago},
    )
    battery_history = [
        {
            "day": row["day"].date().isoformat(),
            "min": row["min_batt"],
            "max": row["max_batt"],
            "avg": round(float(row["avg_batt"]), 1),
        }
        for row in batt_rows.mappings().all()
    ]

    # Recent activity (last 10 events across drives + charges)
    activity_rows = await db.execute(
        text(f"""
            SELECT 'drive' AS type, id, start_date AS ts,
                   distance AS value_km, duration_min, "consumption_kWh" AS kwh,
                   NULL::float AS energy_added
            FROM drives
            WHERE {car_filter} AND end_date IS NOT NULL
            UNION ALL
            SELECT 'charge' AS type, id, start_date AS ts,
                   NULL, duration_min,
                   NULL, charge_energy_added AS energy_added
            FROM charging_processes
            WHERE {car_filter} AND end_date IS NOT NULL
            ORDER BY ts DESC
            LIMIT 10
        """),
    )
    activity = [
        {
            "type": row["type"],
            "id": row["id"],
            "timestamp": row["ts"].isoformat(),
            "distance_km": round(float(row["value_km"]), 1) if row["value_km"] is not None else None,
            "duration_min": row["duration_min"],
            "energy_kwh": round(float(row["kwh"]), 2) if row["kwh"] is not None else None,
            "energy_added_kwh": round(float(row["energy_added"]), 2) if row["energy_added"] is not None else None,
        }
        for row in activity_rows.mappings().all()
    ]

    return {
        "vehicles": vehicle_cards,
        "kpis": kpis,
        "battery_history": battery_history,
        "recent_activity": activity,
    }
