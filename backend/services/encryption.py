"""Fernet symmetric encryption for sensitive values stored in the database."""
import base64
import hashlib

from cryptography.fernet import Fernet

from config import settings


def _get_fernet() -> Fernet:
    # Derive a 32-byte key from ENCRYPTION_KEY via SHA-256, then base64url-encode
    raw = settings.ENCRYPTION_KEY.encode() if settings.ENCRYPTION_KEY else b"insecure-default-key-set-ENCRYPTION_KEY"
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
