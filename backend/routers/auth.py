import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models.invite import Invite
from models.notification_channel import NotificationChannel
from models.user import User
from schemas.auth import LoginRequest, UserOut
from schemas.users import AcceptInviteRequest, BootstrapStatus, SignupRequest
from services.auth_service import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    set_auth_cookies,
    verify_password,
)


async def _default_email_channel(db: AsyncSession, user: User) -> None:
    db.add(NotificationChannel(user_id=user.id, kind="email", target=user.email, is_enabled=False))

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=UserOut)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    set_auth_cookies(response, create_access_token(user.id), create_refresh_token(user.id))
    return user


@router.post("/refresh", response_model=UserOut)
@limiter.limit("20/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    payload = decode_token(token, expected_type="refresh")
    result = await db.execute(select(User).where(User.id == uuid.UUID(payload["sub"])))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    set_auth_cookies(response, create_access_token(user.id), create_refresh_token(user.id))
    return user


@router.get("/bootstrap-status", response_model=BootstrapStatus)
async def bootstrap_status(db: AsyncSession = Depends(get_db)):
    count = (await db.execute(select(func.count(User.id)))).scalar_one()
    return BootstrapStatus(needs_setup=count == 0)


@router.post("/signup", response_model=UserOut)
@limiter.limit("5/minute")
async def signup(
    request: Request,
    body: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """First-run only: create the initial super-admin when no users exist."""
    count = (await db.execute(select(func.count(User.id)))).scalar_one()
    if count > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Setup already complete")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        is_active=True,
        is_superuser=True,
    )
    db.add(user)
    await db.flush()
    await _default_email_channel(db, user)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    set_auth_cookies(response, create_access_token(user.id), create_refresh_token(user.id))
    return user


@router.post("/accept-invite", response_model=UserOut)
@limiter.limit("10/minute")
async def accept_invite(
    request: Request,
    body: AcceptInviteRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    invite = (await db.execute(select(Invite).where(Invite.token == body.token))).scalar_one_or_none()
    if invite is None or invite.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already-used invite")
    if invite.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired")
    existing = (await db.execute(select(User).where(User.email == invite.email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    user = User(
        email=invite.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        is_active=True,
        is_superuser=invite.is_superuser,
    )
    db.add(user)
    await db.flush()
    await _default_email_channel(db, user)
    invite.accepted_at = datetime.now(timezone.utc)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    set_auth_cookies(response, create_access_token(user.id), create_refresh_token(user.id))
    return user


@router.delete("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    clear_auth_cookies(response)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
