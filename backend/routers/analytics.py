"""Analytics endpoints — efficiency, charging stats, vampire drain, timeline."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/efficiency")
async def efficiency(
    car_id: int | None = None,
    days: int = Query(90, ge=7, le=365),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    car_filter = f"car_id = {car_id}" if car_id else "1=1"

    # KPI aggregates
    kpi = await db.execute(
        text(f"""
            SELECT
                COUNT(*) AS count,
                COALESCE(AVG(
                    CASE WHEN distance > 0 THEN "consumption_kWh" / distance * 1000 END
                ), 0) AS avg_wh_km,
                COALESCE(MIN(
                    CASE WHEN distance > 0.5 THEN "consumption_kWh" / distance * 1000 END
                ), 0) AS best_wh_km,
                COALESCE(MAX(
                    CASE WHEN distance > 0 THEN "consumption_kWh" / distance * 1000 END
                ), 0) AS worst_wh_km,
                COALESCE(AVG(outside_temp_avg), 0) AS avg_temp,
                COALESCE(AVG(speed_max), 0) AS avg_speed_max
            FROM drives
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
              AND "consumption_kWh" IS NOT NULL
              AND distance > 0
        """),
        {"since": since},
    )
    kpi_row = kpi.mappings().one()

    # Daily avg efficiency (last N days)
    daily = await db.execute(
        text(f"""
            SELECT
                date_trunc('day', start_date) AS day,
                AVG("consumption_kWh" / distance * 1000) AS avg_wh_km,
                SUM(distance) AS total_km,
                COUNT(*) AS drives
            FROM drives
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
              AND "consumption_kWh" IS NOT NULL
              AND distance > 0
            GROUP BY 1
            ORDER BY 1
        """),
        {"since": since},
    )
    by_day = [
        {
            "day": row["day"].date().isoformat(),
            "avg_wh_km": round(float(row["avg_wh_km"]), 1),
            "total_km": round(float(row["total_km"]), 1),
            "drives": row["drives"],
        }
        for row in daily.mappings().all()
    ]

    # Scatter: outside temp vs Wh/km (individual drives)
    temp_scatter = await db.execute(
        text(f"""
            SELECT
                ROUND(outside_temp_avg::numeric) AS temp_c,
                "consumption_kWh" / distance * 1000 AS wh_km,
                distance
            FROM drives
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
              AND "consumption_kWh" IS NOT NULL
              AND distance > 1
              AND outside_temp_avg IS NOT NULL
            ORDER BY start_date
        """),
        {"since": since},
    )
    by_temp = [
        {
            "temp": float(r["temp_c"]),
            "wh_km": round(float(r["wh_km"]), 1),
            "km": round(float(r["distance"]), 1),
        }
        for r in temp_scatter.mappings().all()
    ]

    # Scatter: speed max vs Wh/km
    speed_scatter = await db.execute(
        text(f"""
            SELECT
                speed_max,
                "consumption_kWh" / distance * 1000 AS wh_km,
                distance
            FROM drives
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
              AND "consumption_kWh" IS NOT NULL
              AND distance > 1
              AND speed_max IS NOT NULL
            ORDER BY start_date
        """),
        {"since": since},
    )
    by_speed = [
        {
            "speed": r["speed_max"],
            "wh_km": round(float(r["wh_km"]), 1),
            "km": round(float(r["distance"]), 1),
        }
        for r in speed_scatter.mappings().all()
    ]

    return {
        "kpis": {
            "drives": int(kpi_row["count"]),
            "avg_wh_km": round(float(kpi_row["avg_wh_km"]), 1),
            "best_wh_km": round(float(kpi_row["best_wh_km"]), 1),
            "worst_wh_km": round(float(kpi_row["worst_wh_km"]), 1),
            "avg_temp_c": round(float(kpi_row["avg_temp"]), 1),
        },
        "by_day": by_day,
        "by_temp": by_temp,
        "by_speed": by_speed,
    }


@router.get("/charging")
async def charging_stats(
    car_id: int | None = None,
    days: int = Query(180, ge=7, le=730),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    car_filter = f"car_id = {car_id}" if car_id else "1=1"

    # KPI aggregates
    kpi = await db.execute(
        text(f"""
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM(charge_energy_added), 0) AS total_kwh,
                COALESCE(AVG(charge_energy_added), 0) AS avg_kwh,
                COALESCE(AVG(duration_min), 0) AS avg_duration_min,
                COALESCE(AVG(start_battery_level), 0) AS avg_start_soc,
                COALESCE(AVG(end_battery_level), 0) AS avg_end_soc,
                COALESCE(SUM(cost), 0) AS total_cost,
                COALESCE(AVG(
                    CASE WHEN duration_min > 0
                    THEN charge_energy_added / duration_min * 60
                    END
                ), 0) AS avg_charge_rate_kw
            FROM charging_processes
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
              AND charge_energy_added IS NOT NULL
        """),
        {"since": since},
    )
    kpi_row = kpi.mappings().one()

    # Monthly: sessions + kWh (last 12 months)
    monthly = await db.execute(
        text(f"""
            SELECT
                to_char(date_trunc('month', start_date), 'YYYY-MM') AS month,
                COUNT(*) AS sessions,
                COALESCE(SUM(charge_energy_added), 0) AS total_kwh,
                COALESCE(AVG(charge_energy_added), 0) AS avg_kwh
            FROM charging_processes
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
              AND charge_energy_added IS NOT NULL
            GROUP BY 1
            ORDER BY 1
        """),
        {"since": since},
    )
    by_month = [
        {
            "month": r["month"],
            "sessions": r["sessions"],
            "total_kwh": round(float(r["total_kwh"]), 2),
            "avg_kwh": round(float(r["avg_kwh"]), 2),
        }
        for r in monthly.mappings().all()
    ]

    # By hour of day
    by_hour_rows = await db.execute(
        text(f"""
            SELECT
                EXTRACT(HOUR FROM start_date AT TIME ZONE 'UTC') AS hour,
                COUNT(*) AS sessions,
                COALESCE(SUM(charge_energy_added), 0) AS total_kwh
            FROM charging_processes
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
            GROUP BY 1
            ORDER BY 1
        """),
        {"since": since},
    )
    # Fill in all 24 hours even if zero
    hour_map = {int(r["hour"]): {"sessions": r["sessions"], "kwh": round(float(r["total_kwh"]), 2)}
                for r in by_hour_rows.mappings().all()}
    by_hour = [
        {"hour": h, "sessions": hour_map.get(h, {}).get("sessions", 0),
         "kwh": hour_map.get(h, {}).get("kwh", 0.0)}
        for h in range(24)
    ]

    # SoC start/end distribution in 10% buckets
    soc_rows = await db.execute(
        text(f"""
            SELECT
                (FLOOR(COALESCE(start_battery_level, 0) / 10) * 10)::int AS bucket,
                COUNT(*) AS count
            FROM charging_processes
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
              AND start_battery_level IS NOT NULL
            GROUP BY 1
            ORDER BY 1
        """),
        {"since": since},
    )
    soc_map = {r["bucket"]: r["count"] for r in soc_rows.mappings().all()}
    soc_distribution = [
        {"range": f"{b}–{b+10}%", "bucket": b, "count": soc_map.get(b, 0)}
        for b in range(0, 100, 10)
    ]

    return {
        "kpis": {
            "sessions": int(kpi_row["count"]),
            "total_kwh": round(float(kpi_row["total_kwh"]), 2),
            "avg_kwh_per_session": round(float(kpi_row["avg_kwh"]), 2),
            "avg_duration_min": round(float(kpi_row["avg_duration_min"]), 1),
            "avg_start_soc": round(float(kpi_row["avg_start_soc"]), 1),
            "avg_end_soc": round(float(kpi_row["avg_end_soc"]), 1),
            "total_cost": round(float(kpi_row["total_cost"]), 2),
            "avg_charge_rate_kw": round(float(kpi_row["avg_charge_rate_kw"]), 2),
        },
        "by_month": by_month,
        "by_hour": by_hour,
        "soc_distribution": soc_distribution,
    }


@router.get("/vampire-drain")
async def vampire_drain(
    car_id: int | None = None,
    days: int = Query(30, ge=7, le=90),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Estimate vampire drain from parked states.
    Uses states table to find asleep/online periods, then looks at battery
    level change via positions at the start and end of each idle period.
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    car_filter = f"s.car_id = {car_id}" if car_id else "1=1"

    # Find idle periods (asleep or online, not driving/charging)
    # Pair with start/end battery levels from positions
    drain_rows = await db.execute(
        text(f"""
            WITH idle_periods AS (
                SELECT
                    s.car_id,
                    s.start_date,
                    COALESCE(s.end_date, NOW()) AS end_date,
                    EXTRACT(EPOCH FROM (COALESCE(s.end_date, NOW()) - s.start_date)) / 3600.0 AS hours
                FROM states s
                WHERE {car_filter}
                  AND s.state IN ('asleep', 'online')
                  AND s.start_date >= :since
                  AND EXTRACT(EPOCH FROM (COALESCE(s.end_date, NOW()) - s.start_date)) / 3600.0 >= 0.5
            ),
            period_battery AS (
                SELECT
                    ip.car_id,
                    ip.start_date,
                    ip.end_date,
                    ip.hours,
                    (SELECT battery_level FROM positions p
                     WHERE p.car_id = ip.car_id AND p.date >= ip.start_date
                     ORDER BY p.date ASC LIMIT 1) AS start_batt,
                    (SELECT battery_level FROM positions p
                     WHERE p.car_id = ip.car_id AND p.date <= ip.end_date
                     ORDER BY p.date DESC LIMIT 1) AS end_batt
                FROM idle_periods ip
            )
            SELECT
                date_trunc('day', start_date) AS day,
                AVG(CASE
                    WHEN start_batt IS NOT NULL AND end_batt IS NOT NULL AND hours > 0
                         AND start_batt > end_batt
                    THEN (start_batt - end_batt)::float / hours
                    ELSE NULL
                END) AS avg_drain_pct_hr,
                SUM(CASE
                    WHEN start_batt IS NOT NULL AND end_batt IS NOT NULL AND start_batt > end_batt
                    THEN (start_batt - end_batt)
                    ELSE 0
                END) AS total_drain_pct,
                SUM(hours) AS total_parked_hours,
                COUNT(*) AS idle_periods
            FROM period_battery
            GROUP BY 1
            ORDER BY 1
        """),
        {"since": since},
    )

    by_day = [
        {
            "day": row["day"].date().isoformat(),
            "avg_drain_pct_hr": round(float(row["avg_drain_pct_hr"]), 3) if row["avg_drain_pct_hr"] else None,
            "total_drain_pct": round(float(row["total_drain_pct"]), 1),
            "parked_hours": round(float(row["total_parked_hours"]), 1),
        }
        for row in drain_rows.mappings().all()
    ]

    # KPI summary
    valid_days = [d for d in by_day if d["avg_drain_pct_hr"] is not None]
    avg_drain = (sum(d["avg_drain_pct_hr"] for d in valid_days) / len(valid_days)) if valid_days else 0
    total_drain = sum(d["total_drain_pct"] for d in by_day)

    return {
        "kpis": {
            "avg_drain_pct_per_hour": round(avg_drain, 3),
            "avg_drain_pct_per_day": round(avg_drain * 24, 2),
            "total_drain_pct": round(total_drain, 1),
            "days_with_data": len(valid_days),
        },
        "by_day": by_day,
    }


@router.get("/timeline")
async def timeline(
    car_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calendar heatmap data: last 365 days, one row per day."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=365)
    car_filter = f"car_id = {car_id}" if car_id else "1=1"

    drives_rows = await db.execute(
        text(f"""
            SELECT
                date_trunc('day', start_date) AS day,
                COUNT(*) AS drives,
                COALESCE(SUM(distance), 0) AS total_km,
                COALESCE(SUM(duration_min), 0) AS total_min,
                COALESCE(SUM("consumption_kWh"), 0) AS total_kwh
            FROM drives
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
            GROUP BY 1
        """),
        {"since": since},
    )
    drive_map = {
        row["day"].date().isoformat(): {
            "drives": int(row["drives"]),
            "km": round(float(row["total_km"]), 1),
            "min": int(row["total_min"]),
            "kwh": round(float(row["total_kwh"]), 2),
        }
        for row in drives_rows.mappings().all()
    }

    charges_rows = await db.execute(
        text(f"""
            SELECT
                date_trunc('day', start_date) AS day,
                COUNT(*) AS charges,
                COALESCE(SUM(charge_energy_added), 0) AS total_kwh
            FROM charging_processes
            WHERE {car_filter}
              AND start_date >= :since
              AND end_date IS NOT NULL
            GROUP BY 1
        """),
        {"since": since},
    )
    charge_map = {
        row["day"].date().isoformat(): {
            "charges": int(row["charges"]),
            "kwh": round(float(row["total_kwh"]), 2),
        }
        for row in charges_rows.mappings().all()
    }

    # Generate all days in range
    days = []
    cursor = since.date()
    end = now.date()
    while cursor <= end:
        iso = cursor.isoformat()
        d = drive_map.get(iso, {"drives": 0, "km": 0.0, "min": 0, "kwh": 0.0})
        c = charge_map.get(iso, {"charges": 0, "kwh": 0.0})
        days.append({
            "date": iso,
            "drives": d["drives"],
            "distance_km": d["km"],
            "drive_min": d["min"],
            "drive_kwh": d["kwh"],
            "charges": c["charges"],
            "charge_kwh": c["kwh"],
        })
        cursor += timedelta(days=1)

    return {"days": days}
