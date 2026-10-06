"""Password hashing and login sessions for Campus Customs.

Password format (matches the users seeded in campus_customs.db):

    pbkdf2_sha256$<salt>$<hex digest>

- PBKDF2-HMAC-SHA256, 120,000 iterations
- the salt is the text between the `$` signs, used as UTF-8 bytes (not hex-decoded)
- the digest is 32 bytes, written as 64 hex characters
- the iteration count is not stored in the string, so it is fixed here

Sessions: after a successful login the backend sets an HttpOnly cookie that holds
a signed token "<user_id>.<expires>.<signature>". The browser sends it back
automatically; JavaScript cannot read it.
"""

import base64
import hashlib
import hmac
import os
import secrets
import time

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 120_000
SALT_BYTES = 8  # rendered as 16 hex characters, like the seeded users

SESSION_COOKIE = "cc_session"
SESSION_MAX_AGE = 7 * 24 * 60 * 60  # 7 days, in seconds

# Signing key for session tokens. Set SESSION_SECRET in the environment to keep
# users logged in across server restarts; otherwise a random key is used per run.
_SECRET = (os.environ.get("SESSION_SECRET") or secrets.token_hex(32)).encode()


# ---------- Passwords ----------

def _pbkdf2(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(SALT_BYTES)
    return f"{ALGORITHM}${salt}${_pbkdf2(password, salt)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, digest = stored_hash.split("$")
    except ValueError:
        return False
    if algorithm != ALGORITHM:
        return False
    return hmac.compare_digest(_pbkdf2(password, salt), digest)


# Used when the email doesn't exist, so a failed login takes the same time either way.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def burn_time(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


# ---------- Session tokens ----------

def _sign(payload: str) -> str:
    mac = hmac.new(_SECRET, payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode().rstrip("=")


def create_session_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + SESSION_MAX_AGE}"
    return f"{payload}.{_sign(payload)}"


def read_session_token(token: str | None) -> int | None:
    """User id from a valid, unexpired token, else None."""
    if not token:
        return None
    try:
        user_id, expires, signature = token.split(".")
        payload = f"{user_id}.{expires}"
        if not hmac.compare_digest(signature, _sign(payload)):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except ValueError:
        return None
