import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.invite import Invite
from models.user import User
from schemas.auth import UserOut
from schemas.users import (
    AdminUserUpdate,
    InviteCreate,
    InviteOut,
    PasswordChange,
    ProfileUpdate,
)
from services import notifications
from services.auth_service import get_current_user, hash_password, require_admin, verify_password

router = APIRouter(prefix="/users", tags=["users"])

INVITE_TTL_DAYS = 7


def _origin(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    return f"{proto}://{host}" if host else ""


def _invite_url(request: Request, token: str) -> str:
    origin = _origin(request)
    return f"{origin}/invite/{token}" if origin else f"/invite/{token}"


# ── Self-service ─────────────────────────────────────────────────────────────────

@router.get("/me/profile", response_model=UserOut)
async def my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me/profile", response_model=UserOut)
async def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.display_name is not None:
        current_user.display_name = body.display_name.strip() or None
    if body.theme is not None:
        current_user.theme = body.theme
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    current_user.must_change_password = False
    await db.commit()


# ── Admin: users ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[UserOut])
async def list_users(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return list(rows)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    # Guard against locking out the last admin
    if user.id == admin.id and body.is_superuser is False:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin rights")
    if body.is_active is not None:
        if user.id == admin.id and not body.is_active:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        user.is_active = body.is_active
    if body.is_superuser is not None:
        user.is_superuser = body.is_superuser
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_superuser:
        admins = (await db.execute(select(func.count(User.id)).where(User.is_superuser.is_(True)))).scalar_one()
        if admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last administrator")
    await db.delete(user)
    await db.commit()


# ── Admin: invites ───────────────────────────────────────────────────────────────

@router.post("/invite", response_model=InviteOut)
async def create_invite(
    body: InviteCreate,
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    token = secrets.token_urlsafe(32)
    invite = Invite(
        email=body.email,
        token=token,
        is_superuser=body.is_superuser,
        invited_by=admin.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    url = _invite_url(request, token)
    # Best-effort email; the link/token is always returned so the admin can share manually.
    try:
        await notifications.send_to_email(
            db, body.email, "You've been invited to KYT",
            f"You've been invited to Know Your Tesla. Set up your account here: {url}",
        )
    except Exception:
        pass

    out = InviteOut.model_validate(invite)
    out.invite_url = url
    return out


@router.get("/invites", response_model=list[InviteOut])
async def list_invites(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(Invite).where(Invite.accepted_at.is_(None)).order_by(Invite.created_at.desc()))
    ).scalars().all()
    return list(rows)


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invite(
    invite_id: uuid.UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    invite = (await db.execute(select(Invite).where(Invite.id == invite_id))).scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    await db.delete(invite)
    await db.commit()
