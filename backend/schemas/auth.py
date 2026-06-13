import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    last_login: datetime | None = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    message: str = "Authenticated"
