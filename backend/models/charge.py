from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Charge(Base):
    __tablename__ = "charges"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    charging_process_id: Mapped[int] = mapped_column(Integer, ForeignKey("charging_processes.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    battery_heater_on: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    charge_energy_added: Mapped[float | None] = mapped_column(Float, nullable=True)
    charger_actual_current: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    charger_phases: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    charger_pilot_current: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    charger_power: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    charger_voltage: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    fast_charger_present: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    fast_charger_brand: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fast_charger_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ideal_battery_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    rated_battery_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    outside_temp: Mapped[float | None] = mapped_column(Float, nullable=True)
    usable_battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
