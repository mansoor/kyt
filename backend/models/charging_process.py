from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from database import Base


class ChargingProcess(Base):
    __tablename__ = "charging_processes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    car_id: Mapped[int] = mapped_column(Integer, ForeignKey("cars.id", ondelete="CASCADE"), nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    charge_energy_added: Mapped[float | None] = mapped_column(Float, nullable=True)
    charge_energy_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    charging_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    start_ideal_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_ideal_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    end_battery_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    duration_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    outside_temp_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    address_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("addresses.id"), nullable=True)
    geofence_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("geofences.id"), nullable=True)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    inserted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
