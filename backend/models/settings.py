from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from database import Base


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    unit_of_length: Mapped[str] = mapped_column(String(2), nullable=False, default="km")
    unit_of_temperature: Mapped[str] = mapped_column(String(1), nullable=False, default="C")
    preferred_range: Mapped[str] = mapped_column(String(10), nullable=False, default="ideal")
    base_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    tesla_public_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    tesla_private_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    tesla_registered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Global SMTP relay (admin-managed) used by Apprise to deliver email notifications
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    smtp_from: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    inserted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
