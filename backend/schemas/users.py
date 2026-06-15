import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str | None = None


class AcceptInviteRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)
    display_name: str | None = None


class InviteCreate(BaseModel):
    email: EmailStr
    is_superuser: bool = False


class InviteOut(BaseModel):
    id: uuid.UUID
    email: str
    is_superuser: bool
    token: str
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime
    invite_url: str | None = None

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_superuser: bool | None = None


class BootstrapStatus(BaseModel):
    needs_setup: bool
