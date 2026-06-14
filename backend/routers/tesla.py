"""Tesla OAuth + vehicle management endpoints."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.car import Car
from models.settings import Settings
from models.tesla_token import TeslaToken
from routers.auth import get_current_user
from services.encryption import decrypt, encrypt
from services.poller import poller
from services.tesla_api import TeslaAPIClient
from services.tesla_oauth import build_auth_url, exchange_code, parse_expiry

logger = logging.getLogger("teslamate.tesla")

router = APIRouter(prefix="/tesla", tags=["tesla"])

# In-memory store for PKCE verifier keyed by state token (process-scoped, sufficient for single instance)
_pending_auth: dict[str, tuple[str, str]] = {}  # state → (code_verifier, user_id)


def _redirect_uri(request: Request) -> str:
    # Prefer explicit env var (required when behind a TLS-terminating proxy like
    # Cloudflare or Traefik — request.base_url will be http:// in that case).
    if settings.TESLA_REDIRECT_URI:
        return settings.TESLA_REDIRECT_URI
    # Fall back to auto-detection; honour X-Forwarded-Proto set by the proxy.
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
    return f"{proto}://{host}/api/tesla/auth/callback"


# ── Auth flow ──────────────────────────────────────────────────────────────────

class AuthURLResponse(BaseModel):
    url: str
    configured: bool


@router.get("/auth/url", response_model=AuthURLResponse)
async def get_auth_url(
    request: Request,
    current_user=Depends(get_current_user),
):
    if not settings.TESLA_CLIENT_ID:
        return AuthURLResponse(url="", configured=False)

    url, verifier, state = build_auth_url(_redirect_uri(request))
    _pending_auth[state] = (verifier, str(current_user.id))
    return AuthURLResponse(url=url, configured=True)


@router.get("/auth/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    entry = _pending_auth.pop(state, None)
    if not entry:
        raise HTTPException(400, "Invalid or expired OAuth state")

    verifier, user_id = entry

    try:
        token_data = await exchange_code(code, verifier, _redirect_uri(request))
    except Exception as exc:
        logger.error("Token exchange failed: %s", exc)
        raise HTTPException(502, "Tesla token exchange failed")

    # Upsert tesla_tokens row for this user
    result = await db.execute(select(TeslaToken).where(TeslaToken.user_id == user_id))
    token_row = result.scalar_one_or_none()
    if token_row:
        token_row.access_token = encrypt(token_data["access_token"])
        token_row.refresh_token = encrypt(token_data["refresh_token"])
        token_row.expires_at = parse_expiry(token_data)
        token_row.scope = token_data.get("scope", "")
    else:
        token_row = TeslaToken(
            user_id=user_id,
            access_token=encrypt(token_data["access_token"]),
            refresh_token=encrypt(token_data["refresh_token"]),
            expires_at=parse_expiry(token_data),
            scope=token_data.get("scope", ""),
        )
        db.add(token_row)
    await db.commit()

    # Sync vehicles from Tesla
    access_token = token_data["access_token"]
    await _sync_vehicles(db, access_token)

    # Redirect to frontend settings page
    return {"status": "connected", "message": "Tesla account connected successfully"}


@router.get("/auth/setup-status")
async def setup_status(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current state of Fleet API setup."""
    row = (await db.execute(select(Settings).where(Settings.id == 1))).scalar_one_or_none()
    return {
        "configured": bool(settings.TESLA_CLIENT_ID and settings.TESLA_CLIENT_SECRET),
        "keys_generated": bool(row and row.tesla_public_key),
        "registered": bool(row and row.tesla_registered),
    }


@router.post("/auth/setup")
async def setup_fleet_api(
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    One-click Fleet API setup:
    1. Generate EC key pair, store in DB (private key encrypted).
    2. POST to /partner_accounts so Tesla fetches the public key and registers the app.
    Idempotent — safe to call again if registration previously failed.
    """
    import httpx
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    if not settings.TESLA_CLIENT_ID or not settings.TESLA_CLIENT_SECRET:
        raise HTTPException(400, "TESLA_CLIENT_ID and TESLA_CLIENT_SECRET must be set in .env")

    row = (await db.execute(select(Settings).where(Settings.id == 1))).scalar_one_or_none()
    if not row:
        raise HTTPException(500, "Settings row not found — run migrations first")

    # Step 1: generate key pair if not already done
    if not row.tesla_public_key:
        private_key = ec.generate_private_key(ec.PRIME256V1())
        pub_pem = private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()
        priv_pem = private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ).decode()
        row.tesla_public_key = pub_pem
        row.tesla_private_key_enc = encrypt(priv_pem)
        await db.commit()
        await db.refresh(row)
        logger.info("Tesla EC key pair generated and stored.")

    # Step 2: register with Tesla (fetch client credentials token then POST /partner_accounts)
    fleet_base = settings.TESLA_FLEET_BASE
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
    if settings.TESLA_REDIRECT_URI:
        parts = settings.TESLA_REDIRECT_URI.split("/")
        domain = parts[2]
    else:
        domain = host

    async with httpx.AsyncClient(timeout=30) as http:
        token_resp = await http.post(
            "https://auth.tesla.com/oauth2/v3/token",
            json={
                "grant_type": "client_credentials",
                "client_id": settings.TESLA_CLIENT_ID,
                "client_secret": settings.TESLA_CLIENT_SECRET,
                "scope": "openid vehicle_device_data vehicle_cmds vehicle_charging_cmds",
                "audience": fleet_base,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(502, f"Failed to get partner token: {token_resp.text}")
        partner_token = token_resp.json().get("access_token")

        reg_resp = await http.post(
            f"{fleet_base}/api/1/partner_accounts",
            headers={"Authorization": f"Bearer {partner_token}"},
            json={"domain": domain},
        )

    if reg_resp.status_code not in (200, 201, 204):
        raise HTTPException(reg_resp.status_code, f"Tesla registration failed: {reg_resp.text}")

    row.tesla_registered = True
    await db.commit()
    logger.info("Tesla Fleet API partner registration complete.")
    return {"status": "ok", "keys_generated": True, "registered": True}


@router.delete("/auth/disconnect", status_code=204)
async def disconnect(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TeslaToken).where(TeslaToken.user_id == current_user.id))
    token_row = result.scalar_one_or_none()
    if token_row:
        await db.delete(token_row)
        await db.commit()


# ── Vehicles ───────────────────────────────────────────────────────────────────

class VehicleOut(BaseModel):
    id: int
    name: str | None
    model: str | None
    vin: str | None
    state: str
    battery_level: int | None

    class Config:
        from_attributes = True


@router.get("/vehicles", response_model=list[VehicleOut])
async def list_vehicles(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Car))
    cars = result.scalars().all()
    poller_status = {s["car_id"]: s for s in poller.get_status()}

    out = []
    for car in cars:
        ps = poller_status.get(car.id, {})
        out.append(VehicleOut(
            id=car.id,
            name=car.name,
            model=car.model or car.marketing_name,
            vin=car.vin,
            state=ps.get("state", "unknown"),
            battery_level=ps.get("battery_level"),
        ))
    return out


@router.post("/vehicles/{car_id}/wake", status_code=202)
async def wake_vehicle(
    car_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_row = await _get_token(db, str(current_user.id))
    access_token = decrypt(token_row.access_token)

    result = await db.execute(select(Car).where(Car.id == car_id))
    car = result.scalar_one_or_none()
    if not car:
        raise HTTPException(404, "Vehicle not found")

    client = TeslaAPIClient(access_token)
    await client.wake_up(car.vid)
    return {"status": "wake_requested"}


@router.get("/poller/status")
async def poller_status(current_user=Depends(get_current_user)):
    return poller.get_status()


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_token(db: AsyncSession, user_id: str) -> TeslaToken:
    result = await db.execute(select(TeslaToken).where(TeslaToken.user_id == user_id))
    token_row = result.scalar_one_or_none()
    if not token_row:
        raise HTTPException(401, "Tesla account not connected")
    return token_row


async def _sync_vehicles(db: AsyncSession, access_token: str) -> None:
    """Fetch vehicles from Tesla API and upsert into cars table."""
    try:
        client = TeslaAPIClient(access_token)
        vehicles = await client.list_vehicles()
        for v in vehicles:
            result = await db.execute(select(Car).where(Car.vid == v["id"]))
            car = result.scalar_one_or_none()
            if not car:
                car = Car(
                    eid=v.get("vehicle_id", v["id"]),
                    vid=v["id"],
                    vin=v.get("vin"),
                    name=v.get("display_name"),
                    model=v.get("model"),
                )
                db.add(car)
                await db.flush()
                poller.add_car(car.id, car.vid)
        await db.commit()
    except Exception as exc:
        logger.error("Vehicle sync failed: %s", exc)
