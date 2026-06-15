"""Per-user alert evaluation engine.

The poller calls the ``on_*`` entry points when vehicle events occur. Each entry
point loads every enabled alert rule of the relevant type (across all users),
applies the rule's thresholds, dedups via ``last_fired_at``, and delivers a
notification through :mod:`services.notifications`.

All evaluation is best-effort: callers wrap these in try/except so a notification
failure can never disrupt data collection.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.alert_rule import AlertRule
from models.geofence import Geofence
from models.user import User
from services import notifications

logger = logging.getLogger("teslamate.alerts")

# Alert type identifiers (kept in sync with the frontend)
CHARGE_STARTED = "charge_started"
CHARGE_STOPPED = "charge_stopped"
CHARGE_COMPLETE = "charge_complete"
LOW_BATTERY = "low_battery"
DRIVE_COMPLETED = "drive_completed"
DRIVE_OUTSIDE_WINDOW = "drive_outside_window"
SPEED_EXCEEDED = "speed_exceeded"
GEOFENCE_ENTER = "geofence_enter"
GEOFENCE_EXIT = "geofence_exit"
SOFTWARE_UPDATE = "software_update"

ALERT_TYPES = [
    CHARGE_STARTED, CHARGE_STOPPED, CHARGE_COMPLETE, LOW_BATTERY,
    DRIVE_COMPLETED, DRIVE_OUTSIDE_WINDOW, SPEED_EXCEEDED,
    GEOFENCE_ENTER, GEOFENCE_EXIT, SOFTWARE_UPDATE,
]

# Cooldowns to avoid spamming for continuously-evaluated alerts (seconds)
_COOLDOWNS = {
    LOW_BATTERY: 6 * 3600,
    SPEED_EXCEEDED: 600,
}


async def _matching_rules(db: AsyncSession, alert_type: str, car_id: int) -> list[AlertRule]:
    rows = (
        await db.execute(
            select(AlertRule).where(
                AlertRule.type == alert_type,
                AlertRule.is_enabled.is_(True),
                (AlertRule.car_id == car_id) | (AlertRule.car_id.is_(None)),
            )
        )
    ).scalars().all()
    return list(rows)


def _on_cooldown(rule: AlertRule) -> bool:
    cooldown = _COOLDOWNS.get(rule.type)
    if not cooldown or rule.last_fired_at is None:
        return False
    age = (datetime.now(timezone.utc) - rule.last_fired_at).total_seconds()
    return age < cooldown


async def _fire(db: AsyncSession, rule: AlertRule, car_id: int, title: str, body: str) -> None:
    user = (await db.execute(select(User).where(User.id == rule.user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        return
    rule.last_fired_at = datetime.now(timezone.utc)
    await db.commit()
    await notifications.send(db, user, title, body, alert_rule_id=rule.id, car_id=car_id)


def _car_label(car_name: str | None, car_id: int) -> str:
    return car_name or f"Car {car_id}"


# ── Charging ───────────────────────────────────────────────────────────────────

async def on_charge_started(db, car_id: int, car_name: str | None, battery_level: int | None) -> None:
    label = _car_label(car_name, car_id)
    for rule in await _matching_rules(db, CHARGE_STARTED, car_id):
        body = f"{label} started charging" + (f" at {battery_level}%." if battery_level is not None else ".")
        await _fire(db, rule, car_id, "Charging started", body)


async def on_charge_stopped(db, car_id: int, car_name: str | None, end_level: int | None, energy_added: float | None) -> None:
    label = _car_label(car_name, car_id)
    added = f" (+{energy_added:.1f} kWh)" if energy_added else ""
    for rule in await _matching_rules(db, CHARGE_STOPPED, car_id):
        body = f"{label} stopped charging at {end_level}%{added}." if end_level is not None else f"{label} stopped charging."
        await _fire(db, rule, car_id, "Charging stopped", body)

    for rule in await _matching_rules(db, CHARGE_COMPLETE, car_id):
        target = rule.params.get("target_pct")
        if target is not None and (end_level is None or end_level < int(target)):
            continue
        tgt = f" (target {target}%)" if target is not None else ""
        body = f"{label} reached {end_level}%{tgt}{added}." if end_level is not None else f"{label} finished charging."
        await _fire(db, rule, car_id, "Charge complete", body)


# ── Battery level (evaluated each position) ──────────────────────────────────────

async def on_battery_level(db, car_id: int, car_name: str | None, prev_level: int | None, level: int | None) -> None:
    if level is None:
        return
    label = _car_label(car_name, car_id)
    for rule in await _matching_rules(db, LOW_BATTERY, car_id):
        threshold = int(rule.params.get("threshold_pct", 20))
        crossed = level <= threshold and (prev_level is None or prev_level > threshold)
        if not crossed or _on_cooldown(rule):
            continue
        await _fire(db, rule, car_id, "Low battery", f"{label} battery is at {level}% (≤ {threshold}%).")


async def on_speed(db, car_id: int, car_name: str | None, speed_kmh: float | None) -> None:
    if speed_kmh is None:
        return
    label = _car_label(car_name, car_id)
    for rule in await _matching_rules(db, SPEED_EXCEEDED, car_id):
        limit = float(rule.params.get("limit_kmh", 120))
        if speed_kmh <= limit or _on_cooldown(rule):
            continue
        await _fire(db, rule, car_id, "Speed alert", f"{label} is travelling at {speed_kmh:.0f} km/h (limit {limit:.0f}).")


# ── Geofence enter/exit ──────────────────────────────────────────────────────────

async def nearest_geofence(db, lat: float | None, lon: float | None) -> Geofence | None:
    if lat is None or lon is None:
        return None
    fences = (await db.execute(select(Geofence))).scalars().all()
    for f in fences:
        if _haversine_m(lat, lon, f.latitude, f.longitude) <= (f.radius or 20):
            return f
    return None


async def on_geofence_change(db, car_id: int, car_name: str | None, prev: Geofence | None, current: Geofence | None) -> None:
    if (prev.id if prev else None) == (current.id if current else None):
        return
    label = _car_label(car_name, car_id)
    if prev is not None:
        for rule in await _matching_rules(db, GEOFENCE_EXIT, car_id):
            gid = rule.params.get("geofence_id")
            if gid in (None, prev.id):
                await _fire(db, rule, car_id, "Left location", f"{label} left {prev.name}.")
    if current is not None:
        for rule in await _matching_rules(db, GEOFENCE_ENTER, car_id):
            gid = rule.params.get("geofence_id")
            if gid in (None, current.id):
                await _fire(db, rule, car_id, "Arrived", f"{label} arrived at {current.name}.")


# ── Drives ───────────────────────────────────────────────────────────────────────

async def on_drive_started(db, car_id: int, car_name: str | None, start_dt: datetime) -> None:
    label = _car_label(car_name, car_id)
    for rule in await _matching_rules(db, DRIVE_OUTSIDE_WINDOW, car_id):
        if _within_window(start_dt, rule.params):
            continue
        local = start_dt.astimezone()
        await _fire(
            db, rule, car_id, "Unexpected drive",
            f"{label} started driving at {local:%a %H:%M}, outside the normal window.",
        )


async def on_drive_completed(db, car_id: int, car_name: str | None, distance_km: float | None,
                             duration_min: int | None, consumption_kwh: float | None) -> None:
    label = _car_label(car_name, car_id)
    parts = []
    if distance_km is not None:
        parts.append(f"{distance_km:.1f} km")
    if duration_min is not None:
        parts.append(f"{duration_min} min")
    if consumption_kwh is not None:
        parts.append(f"{consumption_kwh:.1f} kWh")
    summary = ", ".join(parts) if parts else "drive complete"
    for rule in await _matching_rules(db, DRIVE_COMPLETED, car_id):
        await _fire(db, rule, car_id, "Drive completed", f"{label}: {summary}.")


async def on_software_update(db, car_id: int, car_name: str | None, version: str | None) -> None:
    label = _car_label(car_name, car_id)
    ver = f" to {version}" if version else ""
    for rule in await _matching_rules(db, SOFTWARE_UPDATE, car_id):
        await _fire(db, rule, car_id, "Software update", f"{label} is installing a software update{ver}.")


# ── helpers ──────────────────────────────────────────────────────────────────────

def _within_window(dt: datetime, params: dict) -> bool:
    """True if dt falls inside the allowed days + time window (local time)."""
    days = params.get("days")
    start = params.get("start")
    end = params.get("end")
    local = dt.astimezone()
    if days and local.weekday() not in days:
        return False
    if start and end:
        try:
            sh, sm = (int(x) for x in start.split(":"))
            eh, em = (int(x) for x in end.split(":"))
        except (ValueError, AttributeError):
            return True
        t = local.time()
        win_start, win_end = time(sh, sm), time(eh, em)
        if win_start <= win_end:
            return win_start <= t <= win_end
        return t >= win_start or t <= win_end  # window crosses midnight
    return True


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
