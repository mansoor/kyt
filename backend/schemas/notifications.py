import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChannelOut(BaseModel):
    id: uuid.UUID
    kind: str
    target: str | None = None
    is_enabled: bool

    model_config = {"from_attributes": True}


class ChannelUpdate(BaseModel):
    target: str | None = None
    is_enabled: bool | None = None


class AlertRuleIn(BaseModel):
    type: str
    car_id: int | None = None
    is_enabled: bool = True
    params: dict = Field(default_factory=dict)


class AlertRuleUpdate(BaseModel):
    is_enabled: bool | None = None
    car_id: int | None = None
    params: dict | None = None


class AlertRuleOut(BaseModel):
    id: uuid.UUID
    type: str
    car_id: int | None = None
    is_enabled: bool
    params: dict
    last_fired_at: datetime | None = None

    model_config = {"from_attributes": True}


class SmtpConfig(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_password: str | None = None   # write-only; never returned
    smtp_from: str | None = None
    smtp_use_tls: bool = True


class SmtpOut(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool = True
    password_set: bool = False
