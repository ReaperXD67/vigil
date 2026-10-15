import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import SessionToken, User, now

COOKIE_NAME = "vigil_session"
_password_slots = threading.BoundedSemaphore(2)


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    if not _password_slots.acquire(timeout=1):
        raise HTTPException(429, "Authentication is busy. Try again shortly.")
    try:
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt), n=32768, r=8, p=3, dklen=32, maxmem=64 * 1024 * 1024)
    finally:
        _password_slots.release()
    return f"scrypt$32768$8$3${salt}${digest.hex()}"


_dummy_hash = password_hash("not-a-real-user-password")


def password_matches(password: str, stored: str | None) -> bool:
    candidate = stored or _dummy_hash
    parts = candidate.split("$")
    calculated = password_hash(password, parts[4])
    return hmac.compare_digest(candidate, calculated) and stored is not None


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User, response: Response, request: Request):
    # Rotate the browser's prior token on login; retain sessions on other devices.
    old = request.cookies.get(COOKIE_NAME)
    if old:
        db.execute(delete(SessionToken).where(SessionToken.token_hash == token_hash(old)))
    token = secrets.token_urlsafe(32)
    # Cap active browser sessions and revoke oldest tokens on repeated sign-ins.
    previous = db.scalars(select(SessionToken).where(SessionToken.user_id == user.id).order_by(SessionToken.expires_at.desc()).offset(9)).all()
    for session in previous:
        db.delete(session)
    hours = min(settings.session_hours, settings.demo_hours) if user.is_demo else settings.session_hours
    db.add(SessionToken(token_hash=token_hash(token), user_id=user.id, expires_at=now() + timedelta(hours=hours)))
    response.set_cookie(COOKIE_NAME, token, max_age=hours * 3600, httponly=True, secure=settings.secure_cookies, samesite="lax", path="/")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME, "")
    if len(token) > 128 or not token:
        raise HTTPException(401, "Sign in to continue.")
    user = db.scalar(select(User).join(SessionToken, User.id == SessionToken.user_id).where(SessionToken.token_hash == token_hash(token), SessionToken.expires_at > now()))
    if user is None:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    if user.is_demo and user.created_at.replace(tzinfo=now().tzinfo) < now() - timedelta(hours=settings.demo_hours):
        raise HTTPException(401, "This demo workspace has expired. Start another demo.")
    return user


class RateLimiter:
    """Bounded in-process limits; use one API process or add a shared gateway."""
    def __init__(self):
        self._buckets = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_prune = time.monotonic()

    def allow(self, key: str, maximum: int, window: int = 60) -> bool:
        current = time.monotonic()
        with self._lock:
            if current - self._last_prune > 60:
                self._buckets = defaultdict(deque, {k: v for k, v in self._buckets.items() if v and v[-1] > current - 60})
                self._last_prune = current
            if key not in self._buckets and len(self._buckets) >= 10000:
                return False
            bucket = self._buckets[key]
            while bucket and bucket[0] <= current - window:
                bucket.popleft()
            if len(bucket) >= maximum:
                return False
            bucket.append(current)
            return True

    def clear(self):
        with self._lock:
            self._buckets.clear()


limiter = RateLimiter()
