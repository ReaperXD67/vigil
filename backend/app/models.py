from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str | None] = mapped_column(String(300))
    workspace_slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    quota_revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class CapacityLock(Base):
    __tablename__ = "capacity_locks"
    name: Mapped[str] = mapped_column(String(80), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=0)


class RateWindow(Base):
    __tablename__ = "rate_windows"
    key_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class SessionToken(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Service(Base):
    __tablename__ = "services"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    url: Mapped[str] = mapped_column(String(2048))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(24), default="unknown")
    last_checked: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    latency_ms: Mapped[float | None] = mapped_column(Float)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Check(Base):
    __tablename__ = "checks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(24))
    latency_ms: Mapped[float | None] = mapped_column(Float)
    status_code: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(String(300))
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (Index("ix_checks_owner_service_time", "owner_id", "service_id", "checked_at"),)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[str | None] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(16), default="minor")
    status: Mapped[str] = mapped_column(String(24), default="investigating")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)


class IncidentUpdate(Base):
    __tablename__ = "incident_updates"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="todo")
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Activity(Base):
    __tablename__ = "activity"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
