"""Notification delivery via Apprise.

A single global SMTP relay (configured by an admin and stored in the `settings`
table) is used to send email to each user's notification target. Apprise is a
synchronous library, so sends run in a threadpool to avoid blocking the event loop.
The architecture is intentionally channel-agnostic — adding SMS/Telegram/etc. later
is just another Apprise URL scheme.
"""
from __future__ import annotations

import asyncio
import logging
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.alert_event import AlertEvent
from models.notification_channel import NotificationChannel
from models.settings import Settings
from models.user import User
from services.encryption import decrypt

logger = logging.getLogger("teslamate.notifications")


async def _load_settings(db: AsyncSession) -> Settings | None:
    return (await db.execute(select(Settings).where(Settings.id == 1))).scalar_one_or_none()


def smtp_configured(s: Settings | None) -> bool:
    return bool(s and s.smtp_host and s.smtp_from)


def _build_mailto_url(s: Settings, recipient: str) -> str:
    """Construct an Apprise mailto:// URL for the global relay → recipient."""
    user = quote(s.smtp_username or "", safe="")
    password = ""
    if s.smtp_password_enc:
        try:
            password = quote(decrypt(s.smtp_password_enc), safe="")
        except Exception:
            logger.warning("Could not decrypt SMTP password")
    host = s.smtp_host
    port = s.smtp_port or (587 if s.smtp_use_tls else 25)
    auth = f"{user}:{password}@" if user else ""
    mode = "starttls" if s.smtp_use_tls else "insecure"
    params = [f"from={quote(s.smtp_from, safe='')}", f"to={quote(recipient, safe='')}", f"mode={mode}"]
    return f"mailto://{auth}{host}:{port}?" + "&".join(params)


def _send_sync(url: str, title: str, body: str) -> tuple[bool, str | None]:
    try:
        import apprise

        ap = apprise.Apprise()
        if not ap.add(url):
            return False, "Apprise rejected the notification URL"
        ok = ap.notify(title=title, body=body)
        return bool(ok), None if ok else "Apprise notify returned False"
    except Exception as exc:  # pragma: no cover - defensive
        return False, str(exc)


async def _recipient_for(db: AsyncSession, user: User) -> str | None:
    """User's enabled email channel target, falling back to their account email."""
    chan = (
        await db.execute(
            select(NotificationChannel).where(
                NotificationChannel.user_id == user.id,
                NotificationChannel.kind == "email",
                NotificationChannel.is_enabled.is_(True),
            )
        )
    ).scalar_one_or_none()
    if chan is None:
        return None
    return (chan.target or "").strip() or user.email


async def send(
    db: AsyncSession,
    user: User,
    title: str,
    body: str,
    *,
    alert_rule_id=None,
    car_id: int | None = None,
) -> bool:
    """Deliver a notification to a single user, logging the attempt."""
    s = await _load_settings(db)
    recipient = await _recipient_for(db, user)
    delivered, error = False, None

    if not smtp_configured(s):
        error = "SMTP relay not configured"
    elif not recipient:
        error = "User has no enabled email channel"
    else:
        url = _build_mailto_url(s, recipient)
        delivered, error = await asyncio.to_thread(_send_sync, url, title, body)

    db.add(
        AlertEvent(
            alert_rule_id=alert_rule_id,
            car_id=car_id,
            message=f"{title} — {body}",
            delivered=delivered,
            error=error,
        )
    )
    await db.commit()
    if not delivered:
        logger.warning("Notification to %s not delivered: %s", user.email, error)
    return delivered


async def send_to_email(db: AsyncSession, recipient: str, title: str, body: str) -> bool:
    """Send directly to an email address, bypassing per-user channels (e.g. invites)."""
    s = await _load_settings(db)
    if not smtp_configured(s) or not recipient:
        return False
    url = _build_mailto_url(s, recipient)
    delivered, error = await asyncio.to_thread(_send_sync, url, title, body)
    if not delivered:
        logger.warning("Direct email to %s not delivered: %s", recipient, error)
    return delivered


async def send_test(db: AsyncSession, user: User) -> bool:
    return await send(
        db,
        user,
        "KYT test notification",
        "This is a test email from Know Your Tesla. If you received it, notifications are working.",
    )
