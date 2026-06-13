from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    car_id: Mapped[int] = mapped_column(Integer, ForeignKey("cars.id", ondelete="CASCADE"), nullable=False)
    drive_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("drives.id", ondelete="SET NULL"), nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    elevation: Mapped[float | None] = mapped_column(Float, nullable=True)
    power: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    odometer: Mapped[float | None] = mapped_column(Float, nullable=True)
    ideal_battery_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    est_battery_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    rated_battery_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    usable_battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    battery_heater_no_power: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    battery_heater_on: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    outside_temp: Mapped[float | None] = mapped_column(Float, nullable=True)
    inside_temp: Mapped[float | None] = mapped_column(Float, nullable=True)
    fan_status: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    driver_temp_setting: Mapped[float | None] = mapped_column(Float, nullable=True)
    passenger_temp_setting: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_climate_on: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_rear_defroster_on: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_front_defroster_on: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    tpms_pressure_fl: Mapped[float | None] = mapped_column(Float, nullable=True)
    tpms_pressure_fr: Mapped[float | None] = mapped_column(Float, nullable=True)
    tpms_pressure_rl: Mapped[float | None] = mapped_column(Float, nullable=True)
    tpms_pressure_rr: Mapped[float | None] = mapped_column(Float, nullable=True)
    locked: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sentry_mode: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_user_present: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    shift_state: Mapped[str | None] = mapped_column(String(10), nullable=True)

    __table_args__ = {"postgresql_partition_by": "RANGE (date)"}
