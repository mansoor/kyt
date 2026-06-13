from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from database import Base


class Car(Base):
    __tablename__ = "cars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    eid: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    vid: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    trim_badging: Mapped[str | None] = mapped_column(String(50), nullable=True)
    efficiency: Mapped[float | None] = mapped_column(Float, nullable=True)
    marketing_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    inserted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
