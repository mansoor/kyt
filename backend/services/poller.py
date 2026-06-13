"""Vehicle data poller — APScheduler-based state machine per car."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import AsyncSessionLocal
from models.car import Car
from models.charging_process import ChargingProcess
from models.drive import Drive
from models.position import Position
from models.state import State
from models.tesla_token import TeslaToken
from services.encryption import decrypt, encrypt
from services.tesla_api import TeslaAPIClient, TeslaAPIError
from services.tesla_oauth import parse_expiry, refresh_tokens

logger = logging.getLogger("teslamate.poller")

# Polling intervals (seconds)
INTERVALS = {
    "asleep": 900,       # 15 min
    "online": 60,        # 1 min
    "driving": 5,        # 5 sec
    "charging": 30,      # 30 sec
    "updating": 60,      # 60 sec
}

IDLE_SLEEP_THRESHOLD = 15 * 60  # 15 min idle → allow sleep


@dataclass
class CarState:
    car_id: int
    vehicle_id: int                      # Tesla's vehicle_id (vid)
    poller_state: str = "online"         # asleep/online/driving/charging/updating
    current_drive_id: int | None = None
    current_charge_id: int | None = None
    last_active_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_battery_level: int | None = None
    last_latitude: float | None = None
    last_longitude: float | None = None


class Poller:
    def __init__(self) -> None:
        self._scheduler = AsyncIOScheduler()
        self._states: dict[int, CarState] = {}   # car_id → CarState
        self._mqtt_client = None

    def start(self) -> None:
        self._setup_mqtt()
        self._scheduler.start()
        asyncio.create_task(self._boot())

    def stop(self) -> None:
        self._scheduler.shutdown(wait=False)
        if self._mqtt_client:
            try:
                self._mqtt_client.disconnect()
            except Exception:
                pass

    # ── MQTT ──────────────────────────────────────────────────────────────────

    def _setup_mqtt(self) -> None:
        try:
            from config import settings
            import paho.mqtt.client as mqtt

            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="kyt-poller")
            if settings.MQTT_USERNAME:
                client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
            client.connect_async(settings.MQTT_HOST, settings.MQTT_PORT)
            client.loop_start()
            self._mqtt_client = client
            logger.info("MQTT client started")
        except Exception as exc:
            logger.warning("MQTT not available: %s", exc)

    def _mqtt_publish(self, car_id: int, topic: str, payload: str) -> None:
        if self._mqtt_client:
            full_topic = f"teslamate/cars/{car_id}/{topic}"
            self._mqtt_client.publish(full_topic, payload, retain=True)

    # ── Startup ───────────────────────────────────────────────────────────────

    async def _boot(self) -> None:
        """Load all cars that have tokens and start polling jobs."""
        await asyncio.sleep(2)  # let DB settle
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Car))
            cars = result.scalars().all()
            for car in cars:
                token = await self._load_token_for_car(db, car.id)
                if token:
                    await self._start_car(car, token)

    async def _load_token_for_car(self, db, car_id: int) -> str | None:
        """Return a fresh access_token string for the car, refreshing if needed."""
        # We associate tokens to users; use the first token that exists
        result = await db.execute(select(TeslaToken).limit(1))
        token_row = result.scalar_one_or_none()
        if not token_row:
            return None
        return await self._ensure_fresh_token(db, token_row)

    async def _ensure_fresh_token(self, db, token_row: TeslaToken) -> str | None:
        now = datetime.now(timezone.utc)
        if token_row.expires_at <= now:
            try:
                decrypted_refresh = decrypt(token_row.refresh_token)
                new_tokens = await refresh_tokens(decrypted_refresh)
                token_row.access_token = encrypt(new_tokens["access_token"])
                token_row.refresh_token = encrypt(new_tokens["refresh_token"])
                token_row.expires_at = parse_expiry(new_tokens)
                await db.commit()
            except Exception as exc:
                logger.error("Token refresh failed: %s", exc)
                return None
        return decrypt(token_row.access_token)

    async def _start_car(self, car: Car, access_token: str) -> None:
        state = CarState(car_id=car.id, vehicle_id=car.vid)
        self._states[car.id] = state
        logger.info("Starting poller for car %s (vid=%s)", car.id, car.vid)
        self._schedule_poll(car.id, delay=0)

    def add_car(self, car_id: int, vehicle_id: int) -> None:
        """Called after a new car is registered via OAuth callback."""
        if car_id not in self._states:
            state = CarState(car_id=car_id, vehicle_id=vehicle_id)
            self._states[car_id] = state
            self._schedule_poll(car_id, delay=5)

    # ── Scheduling ────────────────────────────────────────────────────────────

    def _schedule_poll(self, car_id: int, delay: float | None = None) -> None:
        job_id = f"poll_{car_id}"
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)
        state = self._states.get(car_id)
        interval = INTERVALS.get(state.poller_state if state else "online", 60)
        run_at = delay if delay is not None else interval
        self._scheduler.add_job(
            self._poll_car,
            "date",
            run_date=datetime.now(timezone.utc) + timedelta(seconds=run_at),
            args=[car_id],
            id=job_id,
            replace_existing=True,
        )

    # ── Core poll loop ─────────────────────────────────────────────────────────

    async def _poll_car(self, car_id: int) -> None:
        state = self._states.get(car_id)
        if not state:
            return

        async with AsyncSessionLocal() as db:
            access_token = await self._load_token_for_car(db, car_id)
            if not access_token:
                logger.warning("No token for car %s — polling paused", car_id)
                self._schedule_poll(car_id)
                return

            client = TeslaAPIClient(access_token)

            try:
                if state.poller_state == "asleep":
                    await self._poll_asleep(db, state, client)
                else:
                    await self._poll_active(db, state, client)
            except TeslaAPIError as exc:
                if exc.status == 408:
                    await self._transition(db, state, "asleep")
                else:
                    logger.error("Tesla API error for car %s: %s", car_id, exc)
            except Exception as exc:
                logger.error("Unexpected poller error for car %s: %s", car_id, exc)

        self._schedule_poll(car_id)

    async def _poll_asleep(self, db, state: CarState, client: TeslaAPIClient) -> None:
        vehicle_state = await client.get_state(state.vehicle_id)
        if vehicle_state == "online":
            await self._transition(db, state, "online")

    async def _poll_active(self, db, state: CarState, client: TeslaAPIClient) -> None:
        data = await client.vehicle_data(state.vehicle_id)

        drive = data.get("drive_state", {})
        charge = data.get("charge_state", {})
        climate = data.get("climate_state", {})
        vehicle = data.get("vehicle_state", {})

        shift_state = drive.get("shift_state")
        charging_state = charge.get("charging_state", "")
        sw_update = vehicle.get("software_update", {})
        is_installing = sw_update.get("status") == "installing"

        # Write position row
        await self._write_position(db, state, drive, charge, climate, vehicle)

        # State machine transitions
        if state.poller_state == "online":
            if is_installing:
                await self._transition(db, state, "updating")
            elif shift_state in ("D", "R", "N"):
                drive_id = await self._start_drive(db, state, drive, charge)
                state.current_drive_id = drive_id
                await self._transition(db, state, "driving")
            elif charging_state == "Charging":
                charge_id = await self._start_charge(db, state, charge, vehicle)
                state.current_charge_id = charge_id
                await self._transition(db, state, "charging")
            else:
                idle_secs = (datetime.now(timezone.utc) - state.last_active_at).total_seconds()
                if idle_secs > IDLE_SLEEP_THRESHOLD:
                    await self._transition(db, state, "asleep")

        elif state.poller_state == "driving":
            if shift_state == "P" or shift_state is None:
                await self._end_drive(db, state, drive, charge)
                state.current_drive_id = None
                await self._transition(db, state, "online")
            else:
                state.last_active_at = datetime.now(timezone.utc)

        elif state.poller_state == "charging":
            if charging_state != "Charging":
                await self._end_charge(db, state, charge)
                state.current_charge_id = None
                await self._transition(db, state, "online")
            else:
                await self._write_charge_reading(db, state, charge)
                state.last_active_at = datetime.now(timezone.utc)

        elif state.poller_state == "updating":
            if not is_installing:
                await self._transition(db, state, "online")

        # Publish MQTT
        batt = charge.get("battery_level")
        self._mqtt_publish(state.car_id, "battery_level", str(batt) if batt is not None else "")
        self._mqtt_publish(state.car_id, "state", state.poller_state)
        if batt is not None:
            state.last_battery_level = batt

    # ── State transitions ─────────────────────────────────────────────────────

    async def _transition(self, db, state: CarState, new_state: str) -> None:
        if state.poller_state == new_state:
            return
        logger.info("Car %s: %s → %s", state.car_id, state.poller_state, new_state)

        now = datetime.now(timezone.utc)
        # Close current state row
        await db.execute(
            update(State)
            .where(State.car_id == state.car_id, State.end_date.is_(None))
            .values(end_date=now)
        )
        # Open new state row
        db.add(State(car_id=state.car_id, state=new_state, start_date=now))
        await db.commit()

        state.poller_state = new_state
        self._mqtt_publish(state.car_id, "state", new_state)

    # ── Position write ─────────────────────────────────────────────────────────

    async def _write_position(self, db, state: CarState, drive: dict, charge: dict, climate: dict, vehicle: dict) -> None:
        lat = drive.get("latitude")
        lon = drive.get("longitude")
        if lat is None or lon is None:
            return
        pos = Position(
            car_id=state.car_id,
            drive_id=state.current_drive_id,
            date=datetime.now(timezone.utc),
            latitude=lat,
            longitude=lon,
            speed=drive.get("speed"),
            heading=drive.get("heading"),
            elevation=None,
            power=drive.get("power"),
            odometer=vehicle.get("odometer"),
            ideal_battery_range_km=_miles_to_km(charge.get("ideal_battery_range")),
            est_battery_range_km=_miles_to_km(charge.get("est_battery_range")),
            rated_battery_range_km=_miles_to_km(charge.get("battery_range")),
            battery_level=charge.get("battery_level"),
            usable_battery_level=charge.get("usable_battery_level"),
            outside_temp=climate.get("outside_temp"),
            inside_temp=climate.get("inside_temp"),
            is_climate_on=climate.get("is_climate_on"),
            fan_status=climate.get("fan_status"),
            driver_temp_setting=climate.get("driver_temp_setting"),
            passenger_temp_setting=climate.get("passenger_temp_setting"),
            is_rear_defroster_on=climate.get("is_rear_defroster_on"),
            is_front_defroster_on=climate.get("is_front_defroster_on"),
            battery_heater_on=climate.get("battery_heater"),
            battery_heater_no_power=climate.get("battery_heater_no_power"),
            tpms_pressure_fl=vehicle.get("tpms_pressure_fl"),
            tpms_pressure_fr=vehicle.get("tpms_pressure_fr"),
            tpms_pressure_rl=vehicle.get("tpms_pressure_rl"),
            tpms_pressure_rr=vehicle.get("tpms_pressure_rr"),
            locked=vehicle.get("locked"),
            sentry_mode=vehicle.get("sentry_mode"),
            is_user_present=vehicle.get("is_user_present"),
            shift_state=drive.get("shift_state"),
        )
        db.add(pos)
        await db.commit()
        state.last_latitude = lat
        state.last_longitude = lon

    # ── Drive start/end ───────────────────────────────────────────────────────

    async def _start_drive(self, db, state: CarState, drive: dict, charge: dict) -> int:
        now = datetime.now(timezone.utc)
        d = Drive(
            car_id=state.car_id,
            start_date=now,
            start_ideal_range_km=_miles_to_km(charge.get("ideal_battery_range")),
            start_km=_miles_to_km(drive.get("odometer")),
            outside_temp_avg=None,
        )
        db.add(d)
        await db.flush()
        await db.commit()
        return d.id

    async def _end_drive(self, db, state: CarState, drive: dict, charge: dict) -> None:
        if not state.current_drive_id:
            return
        now = datetime.now(timezone.utc)
        await db.execute(
            update(Drive)
            .where(Drive.id == state.current_drive_id)
            .values(
                end_date=now,
                end_ideal_range_km=_miles_to_km(charge.get("ideal_battery_range")),
                end_km=_miles_to_km(drive.get("odometer")),
            )
        )
        await db.commit()

    # ── Charge session start/end ───────────────────────────────────────────────

    async def _start_charge(self, db, state: CarState, charge: dict, vehicle: dict) -> int:
        now = datetime.now(timezone.utc)
        cp = ChargingProcess(
            car_id=state.car_id,
            start_date=now,
            start_battery_level=charge.get("battery_level"),
            start_ideal_range_km=_miles_to_km(charge.get("ideal_battery_range")),
        )
        db.add(cp)
        await db.flush()
        await db.commit()
        return cp.id

    async def _end_charge(self, db, state: CarState, charge: dict) -> None:
        if not state.current_charge_id:
            return
        now = datetime.now(timezone.utc)
        await db.execute(
            update(ChargingProcess)
            .where(ChargingProcess.id == state.current_charge_id)
            .values(
                end_date=now,
                end_battery_level=charge.get("battery_level"),
                end_ideal_range_km=_miles_to_km(charge.get("ideal_battery_range")),
                charge_energy_added=charge.get("charge_energy_added"),
                duration_min=None,
                charging_status="done",
            )
        )
        await db.commit()

    async def _write_charge_reading(self, db, state: CarState, charge: dict) -> None:
        from models.charge import Charge
        c = Charge(
            charging_process_id=state.current_charge_id,
            date=datetime.now(timezone.utc),
            battery_level=charge.get("battery_level"),
            charge_energy_added=charge.get("charge_energy_added"),
            charger_actual_current=charge.get("charger_actual_current"),
            charger_phases=charge.get("charger_phases"),
            charger_pilot_current=charge.get("charger_pilot_current"),
            charger_power=charge.get("charger_power"),
            charger_voltage=charge.get("charger_voltage"),
            fast_charger_present=charge.get("fast_charger_present"),
            fast_charger_brand=charge.get("fast_charger_brand"),
            fast_charger_type=charge.get("fast_charger_type"),
            ideal_battery_range_km=_miles_to_km(charge.get("ideal_battery_range")),
            rated_battery_range_km=_miles_to_km(charge.get("battery_range")),
            usable_battery_level=charge.get("usable_battery_level"),
        )
        db.add(c)
        await db.commit()

    # ── Public status ──────────────────────────────────────────────────────────

    def get_status(self) -> list[dict]:
        return [
            {
                "car_id": s.car_id,
                "state": s.poller_state,
                "battery_level": s.last_battery_level,
                "latitude": s.last_latitude,
                "longitude": s.last_longitude,
            }
            for s in self._states.values()
        ]


def _miles_to_km(miles: float | None) -> float | None:
    if miles is None:
        return None
    return round(miles * 1.60934, 2)


# Singleton
poller = Poller()
