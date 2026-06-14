"""Tesla OAuth 2.0 + PKCE flow helpers."""
import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from config import settings

TESLA_AUTH_BASE = "https://auth.tesla.com/oauth2/v3"
TESLA_SCOPES = "openid email offline_access vehicle_device_data vehicle_cmds vehicle_charging_cmds"


def _fleet_audience() -> str:
    return settings.TESLA_FLEET_BASE


def _pkce_pair() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(os.urandom(48)).rstrip(b"=").decode()
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def build_auth_url(redirect_uri: str) -> tuple[str, str, str]:
    """Return (auth_url, code_verifier, state_token) — caller must store verifier & state."""
    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(24)
    params = {
        "response_type": "code",
        "client_id": settings.TESLA_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": TESLA_SCOPES,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "audience": _fleet_audience(),
    }
    return f"{TESLA_AUTH_BASE}/authorize?{urlencode(params)}", verifier, state


async def exchange_code(code: str, verifier: str, redirect_uri: str) -> dict:
    """Exchange authorization code + PKCE verifier for tokens."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{TESLA_AUTH_BASE}/token",
            json={
                "grant_type": "authorization_code",
                "client_id": settings.TESLA_CLIENT_ID,
                "client_secret": settings.TESLA_CLIENT_SECRET,
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": redirect_uri,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_tokens(refresh_token: str) -> dict:
    """Refresh an expired access token; returns new token dict."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{TESLA_AUTH_BASE}/token",
            json={
                "grant_type": "refresh_token",
                "client_id": settings.TESLA_CLIENT_ID,
                "client_secret": settings.TESLA_CLIENT_SECRET,
                "refresh_token": refresh_token,
            },
        )
        resp.raise_for_status()
        return resp.json()


def parse_expiry(token_data: dict) -> datetime:
    expires_in = int(token_data.get("expires_in", 3600))
    return datetime.now(timezone.utc) + timedelta(seconds=expires_in - 60)
