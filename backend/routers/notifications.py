import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.alert_rule import AlertRule
from models.notification_channel import NotificationChannel
from models.settings import Settings
from models.user import User
from schemas.notifications import (
    AlertRuleIn,
    AlertRuleOut,
    AlertRuleUpdate,
    ChannelOut,
    ChannelUpdate,
    SmtpConfig,
    SmtpOut,
)
from services import alerts, notifications
from services.auth_service import get_current_user, require_admin
from services.encryption import encrypt

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Channels ─────────────────────────────────────────────────────────────────────

@router.get("/channels", response_model=list[ChannelOut])
async def list_channels(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(NotificationChannel).where(NotificationChannel.user_id == current_user.id))
    ).scalars().all()
    if not rows:
        # Lazily create the default email channel (disabled) so the UI always has one.
        chan = NotificationChannel(user_id=current_user.id, kind="email", target=current_user.email, is_enabled=False)
        db.add(chan)
        await db.commit()
        await db.refresh(chan)
        rows = [chan]
    return list(rows)


@router.patch("/channels/{channel_id}", response_model=ChannelOut)
async def update_channel(
    channel_id: uuid.UUID,
    body: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chan = (
        await db.execute(
            select(NotificationChannel).where(
                NotificationChannel.id == channel_id,
                NotificationChannel.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if chan is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if body.target is not None:
        chan.target = body.target.strip() or None
    if body.is_enabled is not None:
        chan.is_enabled = body.is_enabled
    await db.commit()
    await db.refresh(chan)
    return chan


@router.post("/test", status_code=status.HTTP_200_OK)
async def send_test(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ok = await notifications.send_test(db, current_user)
    if not ok:
        raise HTTPException(status_code=400, detail="Test failed — check SMTP settings and that your email channel is enabled.")
    return {"delivered": True}


# ── Alert rules ──────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=list[AlertRuleOut])
async def list_alerts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(AlertRule).where(AlertRule.user_id == current_user.id).order_by(AlertRule.created_at)
        )
    ).scalars().all()
    return list(rows)


@router.post("/alerts", response_model=AlertRuleOut)
async def create_alert(
    body: AlertRuleIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.type not in alerts.ALERT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown alert type: {body.type}")
    rule = AlertRule(
        user_id=current_user.id,
        car_id=body.car_id,
        type=body.type,
        is_enabled=body.is_enabled,
        params=body.params or {},
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.patch("/alerts/{rule_id}", response_model=AlertRuleOut)
async def update_alert(
    rule_id: uuid.UUID,
    body: AlertRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = (
        await db.execute(
            select(AlertRule).where(AlertRule.id == rule_id, AlertRule.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    if body.is_enabled is not None:
        rule.is_enabled = body.is_enabled
    if "car_id" in body.model_fields_set:
        rule.car_id = body.car_id
    if body.params is not None:
        rule.params = body.params
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/alerts/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = (
        await db.execute(
            select(AlertRule).where(AlertRule.id == rule_id, AlertRule.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    await db.delete(rule)
    await db.commit()


# ── Admin: global SMTP relay ─────────────────────────────────────────────────────

async def _settings_row(db: AsyncSession) -> Settings:
    row = (await db.execute(select(Settings).where(Settings.id == 1))).scalar_one_or_none()
    if row is None:
        row = Settings(id=1)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("/smtp", response_model=SmtpOut)
async def get_smtp(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    s = await _settings_row(db)
    return SmtpOut(
        smtp_host=s.smtp_host,
        smtp_port=s.smtp_port,
        smtp_username=s.smtp_username,
        smtp_from=s.smtp_from,
        smtp_use_tls=s.smtp_use_tls,
        password_set=bool(s.smtp_password_enc),
    )


@router.put("/smtp", response_model=SmtpOut)
async def update_smtp(
    body: SmtpConfig,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    s = await _settings_row(db)
    s.smtp_host = body.smtp_host
    s.smtp_port = body.smtp_port
    s.smtp_username = body.smtp_username
    s.smtp_from = body.smtp_from
    s.smtp_use_tls = body.smtp_use_tls
    if body.smtp_password:  # only overwrite when a new password is supplied
        s.smtp_password_enc = encrypt(body.smtp_password)
    await db.commit()
    await db.refresh(s)
    return SmtpOut(
        smtp_host=s.smtp_host,
        smtp_port=s.smtp_port,
        smtp_username=s.smtp_username,
        smtp_from=s.smtp_from,
        smtp_use_tls=s.smtp_use_tls,
        password_set=bool(s.smtp_password_enc),
    )
