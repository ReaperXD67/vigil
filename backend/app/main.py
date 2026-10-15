import asyncio
import logging
import secrets
import threading
import time
from contextlib import asynccontextmanager, suppress
from datetime import timedelta

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import Integer, delete, func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from . import database
from .config import settings
from .database import get_db
from .models import Activity, Check, Incident, IncidentUpdate, Service, SessionToken, Task, User, now
from .presenters import activity_json, check_json, incident_json, iso, service_json, task_json, user_json
from .probe import UnsafeTarget, probe
from .schemas import IncidentCreate, IncidentPatch, Login, Register, ServiceCreate, ServicePatch, TaskCreate, TaskPatch, UpdateCreate
from .security import COOKIE_NAME, create_session, current_user, limiter, password_hash, password_matches, token_hash
from .seed import seed_demo

logger = logging.getLogger("vigil")
metrics_lock = threading.Lock()
metrics = {"requests": 0, "errors": 0, "checks": 0}
LATENCY_BUCKETS = (0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10)
latency_counts = {bound: 0 for bound in LATENCY_BUCKETS}
latency_sum = 0.0
latency_total = 0
STARTED_AT = time.monotonic()


def metric(name):
    with metrics_lock:
        metrics[name] += 1


def owned(db: Session, model, resource_id: str, user: User):
    resource = db.scalar(select(model).where(model.id == resource_id, model.owner_id == user.id))
    if resource is None:
        raise HTTPException(404, "Resource not found.")
    return resource


def quota(db, model, user, maximum):
    if db.scalar(select(func.count()).select_from(model).where(model.owner_id == user.id)) >= maximum:
        raise HTTPException(409, f"Workspace limit reached ({maximum}). Remove an existing item first.")


def activity(db, user, kind, message):
    db.add(Activity(owner_id=user.id, type=kind, message=message[:300], is_sample=user.is_demo))
    # Keep activity storage bounded without removing incident timelines.
    stale = select(Activity.id).where(Activity.owner_id == user.id).order_by(Activity.created_at.desc()).offset(1000)
    db.execute(delete(Activity).where(Activity.id.in_(stale)))


def prune_expired(db):
    db.execute(delete(SessionToken).where(SessionToken.expires_at < now()))
    db.execute(delete(User).where(User.is_demo.is_(True), User.created_at < now() - timedelta(hours=settings.demo_hours)))
    db.commit()


def record_check(db, user, service, result):
    check = Check(owner_id=user.id, service_id=service.id, status=result.status, latency_ms=result.latency_ms, status_code=result.status_code, error=result.error)
    previous_status = service.status
    service.status, service.latency_ms, service.last_checked = result.status, result.latency_ms, now()
    db.add(check)
    if previous_status != result.status:
        activity(db, user, "service.status", f"{service.name} changed from {previous_status} to {result.status}")
    stale = select(Check.id).where(Check.service_id == service.id).order_by(Check.checked_at.desc()).offset(500)
    db.execute(delete(Check).where(Check.id.in_(stale)))
    db.commit()
    metric("checks")
    return check


def maintenance_cycle():
    with database.SessionLocal() as db:
        prune_expired(db)
        if not settings.check_worker_enabled:
            return
        interval = max(60, settings.check_interval_seconds)
        cutoff = now() - timedelta(seconds=interval)
        services = db.scalars(select(Service).join(User, Service.owner_id == User.id).where(User.is_demo.is_(False), (Service.last_checked.is_(None) | (Service.last_checked < cutoff))).limit(25)).all()
        for service in services:
            if not limiter.allow(f"probe:{service.id}", 1):
                continue
            user = db.get(User, service.owner_id)
            try:
                result = probe(service.url)
                record_check(db, user, service, result)
            except UnsafeTarget:
                # Invalid/rebound targets are never contacted or marked as an outage.
                logger.warning("Scheduled check blocked by target validation")
            except Exception:
                db.rollback()
                logger.exception("Scheduled check failed")


async def maintenance_loop():
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(maintenance_cycle)
        except Exception:
            logger.exception("Workspace maintenance failed")


@asynccontextmanager
async def lifespan(app):
    # Production uses the checked-in Alembic migration, never implicit DDL.
    if settings.app_env != "production":
        database.Base.metadata.create_all(database.engine)
    worker = asyncio.create_task(maintenance_loop())
    try:
        yield
    finally:
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker


app = FastAPI(title="Vigil API", version="1.0.0", description="Service health, incident response, and remediation tasks. Demo telemetry is explicitly sample data.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"], allow_headers=["Content-Type"])


async def enforce_boundary(request: Request, call_next):
    unsafe = request.method in {"POST", "PUT", "PATCH", "DELETE"}
    if unsafe:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in settings.origins:
            return JSONResponse({"detail": "This origin is not allowed."}, status_code=403)
        if not origin and settings.app_env == "production":
            return JSONResponse({"detail": "An allowed Origin header is required."}, status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Cross-site mutations are not allowed."}, status_code=403)
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            if size > 32768:
                return JSONResponse({"detail": "Request body exceeds 32 KiB."}, status_code=413)
            chunks.append(chunk)
        request._body = b"".join(chunks)
    ip = request.client.host if request.client else "unknown"
    category = "auth" if request.url.path.startswith("/api/auth/") and unsafe else "write" if unsafe else "read"
    maximum = 12 if category == "auth" else 60 if category == "write" else 240
    if not limiter.allow(f"{category}:{ip}", maximum):
        return JSONResponse({"detail": "Too many requests. Try again in a minute."}, status_code=429, headers={"Retry-After": "60"})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    if settings.secure_cookies:
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


@app.middleware("http")
async def boundary(request: Request, call_next):
    global latency_sum, latency_total
    started = time.monotonic()
    metric("requests")
    try:
        response = await enforce_boundary(request, call_next)
        if response.status_code >= 500:
            metric("errors")
        return response
    except Exception:
        metric("errors")
        raise
    finally:
        elapsed = time.monotonic() - started
        with metrics_lock:
            latency_sum += elapsed
            latency_total += 1
            for bound in LATENCY_BUCKETS:
                if elapsed <= bound:
                    latency_counts[bound] += 1


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/ready")
@app.get("/api/ready")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db.execute(select(User.id).limit(1))
    except SQLAlchemyError:
        return JSONResponse({"status": "not_ready", "database": "unavailable"}, status_code=503)
    return {"status": "ready", "database": "ok"}


@app.get("/metrics", response_class=PlainTextResponse)
@app.get("/api/metrics", response_class=PlainTextResponse)
def prometheus_metrics():
    with metrics_lock:
        values = dict(metrics)
        buckets, duration_sum, duration_count = dict(latency_counts), latency_sum, latency_total
    histogram = "# TYPE vigil_http_request_duration_seconds histogram\n"
    histogram += "".join(f'vigil_http_request_duration_seconds_bucket{{le="{bound}"}} {count}\n' for bound, count in buckets.items())
    histogram += f'vigil_http_request_duration_seconds_bucket{{le="+Inf"}} {duration_count}\nvigil_http_request_duration_seconds_sum {duration_sum:.6f}\nvigil_http_request_duration_seconds_count {duration_count}\n'
    return PlainTextResponse(f"# HELP vigil_http_requests_total Requests handled by this API process.\n# TYPE vigil_http_requests_total counter\nvigil_http_requests_total {values['requests']}\n# TYPE vigil_http_errors_total counter\nvigil_http_errors_total {values['errors']}\n# TYPE vigil_checks_total counter\nvigil_checks_total {values['checks']}\n# TYPE vigil_process_uptime_seconds gauge\nvigil_process_uptime_seconds {time.monotonic() - STARTED_AT:.1f}\n" + histogram, media_type="text/plain; version=0.0.4")


@app.post("/api/auth/register", status_code=201)
def register(data: Register, request: Request, response: Response, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account with that email already exists.")
    user = User(email=email, name=data.name, password_hash=password_hash(data.password), workspace_slug=f"workspace-{secrets.token_hex(6)}")
    db.add(user)
    try:
        db.flush()
        activity(db, user, "workspace.created", "Workspace created. Add your first service to begin.")
        create_session(db, user, response, request)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with that email already exists.")
    return {"user": user_json(user)}


@app.post("/api/auth/login")
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower(), User.is_demo.is_(False)))
    if not password_matches(data.password, user.password_hash if user else None):
        raise HTTPException(401, "Email or password is incorrect.")
    create_session(db, user, response, request)
    db.commit()
    return {"user": user_json(user)}


@app.post("/api/auth/demo")
def demo(request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        existing = current_user(request, db)
        if existing.is_demo:
            return {"user": user_json(existing)}
    except HTTPException:
        pass
    ip = request.client.host if request.client else "unknown"
    if not limiter.allow(f"demo:{ip}", 5):
        raise HTTPException(429, "Demo creation limit reached. Please wait one minute.")
    prune_expired(db)
    if db.scalar(select(func.count()).select_from(User).where(User.is_demo.is_(True))) >= settings.max_demo_workspaces:
        raise HTTPException(503, "The demo is at capacity. Please try again later.")
    suffix = secrets.token_hex(8)
    user = User(name="Demo workspace", email=f"demo-{suffix}@example.invalid", is_demo=True, workspace_slug=f"demo-{suffix}")
    db.add(user)
    db.flush()
    seed_demo(db, user)
    create_session(db, user, response, request)
    db.commit()
    return {"user": user_json(user)}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return {"user": user_json(user)}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.execute(delete(SessionToken).where(SessionToken.token_hash == token_hash(token)))
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/", secure=settings.secure_cookies, httponly=True, samesite="lax")
    return {"ok": True}


@app.get("/api/services")
def services(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [service_json(db, item) for item in db.scalars(select(Service).where(Service.owner_id == user.id).order_by(Service.created_at))]


@app.post("/api/services", status_code=201)
def service_create(data: ServiceCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    quota(db, Service, user, 25)
    service = Service(owner_id=user.id, is_sample=user.is_demo, **data.model_dump())
    db.add(service)
    activity(db, user, "service.created", f"Service added: {service.name}")
    db.commit()
    return service_json(db, service)


@app.get("/api/services/{service_id}")
def service_get(service_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return service_json(db, owned(db, Service, service_id, user))


@app.patch("/api/services/{service_id}")
@app.put("/api/services/{service_id}")
def service_patch(service_id: str, data: ServicePatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    service = owned(db, Service, service_id, user)
    values = data.model_dump(exclude_unset=True)
    if "url" in values and values["url"] != service.url:
        db.execute(delete(Check).where(Check.service_id == service.id))
        service.status, service.last_checked, service.latency_ms = "unknown", None, None
    for key, value in values.items():
        setattr(service, key, value)
    activity(db, user, "service.updated", f"Service updated: {service.name}")
    db.commit()
    return service_json(db, service)


@app.delete("/api/services/{service_id}")
def service_delete(service_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    service = owned(db, Service, service_id, user)
    activity(db, user, "service.deleted", f"Service removed: {service.name}")
    db.delete(service)
    db.commit()
    return {"ok": True}


@app.get("/api/services/{service_id}/checks")
def service_checks(service_id: str, limit: int = Query(30, ge=1, le=100), user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned(db, Service, service_id, user)
    return [check_json(c) for c in db.scalars(select(Check).where(Check.service_id == service_id, Check.owner_id == user.id).order_by(Check.checked_at.desc()).limit(limit))]


@app.post("/api/services/{service_id}/check")
def service_check(service_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    service = owned(db, Service, service_id, user)
    if user.is_demo:
        raise HTTPException(403, "External checks require a registered account. Demo telemetry is sample data.")
    if not limiter.allow(f"probe:{service.id}", 1):
        raise HTTPException(429, "Wait one minute between checks for this service.")
    try:
        result = probe(service.url)
    except UnsafeTarget as exc:
        raise HTTPException(422, str(exc)) from exc
    except TimeoutError:
        raise HTTPException(504, "DNS resolution timed out.")
    return check_json(record_check(db, user, service, result))


@app.get("/api/incidents")
def incidents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [incident_json(db, item) for item in db.scalars(select(Incident).where(Incident.owner_id == user.id).order_by(Incident.created_at.desc()))]


@app.post("/api/incidents", status_code=201)
def incident_create(data: IncidentCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    quota(db, Incident, user, 200)
    if data.service_id:
        owned(db, Service, data.service_id, user)
    incident = Incident(owner_id=user.id, is_sample=user.is_demo, **data.model_dump())
    db.add(incident)
    db.flush()
    db.add(IncidentUpdate(incident_id=incident.id, message="Incident opened. Investigation started.", status="investigating"))
    activity(db, user, "incident.created", f"Incident opened: {incident.title}")
    db.commit()
    return incident_json(db, incident)


@app.get("/api/incidents/{incident_id}")
def incident_get(incident_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return incident_json(db, owned(db, Incident, incident_id, user))


def transition(incident, status):
    if status != incident.status:
        incident.status = status
        incident.resolved_at = now() if status == "resolved" else None
    incident.updated_at = now()


def timeline_quota(db, incident):
    count = db.scalar(select(func.count()).select_from(IncidentUpdate).where(IncidentUpdate.incident_id == incident.id))
    if count >= 200:
        raise HTTPException(409, "Incident timeline limit reached (200).")


@app.patch("/api/incidents/{incident_id}")
@app.put("/api/incidents/{incident_id}")
def incident_patch(incident_id: str, data: IncidentPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    incident = owned(db, Incident, incident_id, user)
    values = data.model_dump(exclude_unset=True)
    if values.get("service_id"):
        owned(db, Service, values["service_id"], user)
    status = values.pop("status", None)
    if status and status != incident.status:
        timeline_quota(db, incident)
        transition(incident, status)
        db.add(IncidentUpdate(incident_id=incident.id, message=f"Status changed to {status}.", status=status))
    for key, value in values.items():
        setattr(incident, key, value)
    incident.updated_at = now()
    activity(db, user, "incident.updated", f"Incident updated: {incident.title}")
    db.commit()
    return incident_json(db, incident)


@app.delete("/api/incidents/{incident_id}")
def incident_delete(incident_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    incident = owned(db, Incident, incident_id, user)
    activity(db, user, "incident.deleted", f"Incident removed: {incident.title}")
    db.delete(incident)
    db.commit()
    return {"ok": True}


@app.post("/api/incidents/{incident_id}/updates")
def incident_update(incident_id: str, data: UpdateCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    incident = owned(db, Incident, incident_id, user)
    timeline_quota(db, incident)
    transition(incident, data.status or incident.status)
    db.add(IncidentUpdate(incident_id=incident.id, message=data.message, status=incident.status))
    activity(db, user, "incident.updated", f"Timeline update: {incident.title}")
    db.commit()
    return incident_json(db, incident)


@app.get("/api/incidents/{incident_id}/postmortem")
def postmortem(incident_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    incident = owned(db, Incident, incident_id, user)
    value = incident_json(db, incident)
    tasks = db.scalars(select(Task).where(Task.owner_id == user.id, Task.incident_id == incident.id)).all()
    lines = [f"# Incident report: {incident.title}", "", "> SAMPLE DATA — fictional demo incident." if incident.is_sample else "> Generated from recorded incident data; add your analysis before publishing.", "", f"- Severity: {incident.severity}", f"- Status: {incident.status}", f"- Service: {value['service_name'] or 'Not linked'}", f"- Opened: {iso(incident.created_at)}", f"- Resolved: {iso(incident.resolved_at) or 'Not yet resolved'}", "", "## Summary", "", incident.description or "No description recorded.", "", "## Timeline", ""]
    lines += [f"- {x['created_at']} — **{x['status']}**: {x['message']}" for x in value["updates"]]
    lines += ["", "## Follow-up actions", ""]
    lines += [f"- [{'x' if t.status == 'done' else ' '}] {t.title} ({t.priority}, {t.status})" for t in tasks] or ["No follow-up tasks recorded."]
    lines += ["", "## Root cause", "", "Not documented. Add the verified cause and contributing factors.", "", "## Prevention", "", "Record the changes that will prevent recurrence.", ""]
    return {"markdown": "\n".join(lines)}


@app.get("/api/tasks")
def tasks(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [task_json(t) for t in db.scalars(select(Task).where(Task.owner_id == user.id).order_by(Task.created_at.desc()))]


@app.post("/api/tasks", status_code=201)
def task_create(data: TaskCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    quota(db, Task, user, 500)
    if data.incident_id:
        owned(db, Incident, data.incident_id, user)
    task = Task(owner_id=user.id, is_sample=user.is_demo, **data.model_dump())
    db.add(task)
    activity(db, user, "task.created", f"Task created: {task.title}")
    db.commit()
    return task_json(task)


@app.get("/api/tasks/{task_id}")
def task_get(task_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return task_json(owned(db, Task, task_id, user))


@app.patch("/api/tasks/{task_id}")
@app.put("/api/tasks/{task_id}")
def task_patch(task_id: str, data: TaskPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    task = owned(db, Task, task_id, user)
    values = data.model_dump(exclude_unset=True)
    if values.get("incident_id"):
        owned(db, Incident, values["incident_id"], user)
    for key, value in values.items():
        setattr(task, key, value)
    task.updated_at = now()
    activity(db, user, "task.updated", f"Task updated: {task.title}")
    db.commit()
    return task_json(task)


@app.delete("/api/tasks/{task_id}")
def task_delete(task_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    task = owned(db, Task, task_id, user)
    activity(db, user, "task.deleted", f"Task removed: {task.title}")
    db.delete(task)
    db.commit()
    return {"ok": True}


@app.get("/api/stats")
def stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    def count(model, *conditions):
        return db.scalar(select(func.count()).select_from(model).where(model.owner_id == user.id, *conditions))
    total, successful, latency = db.execute(select(func.count(Check.id), func.sum((Check.status == "operational").cast(Integer)), func.avg(Check.latency_ms)).where(Check.owner_id == user.id)).one()
    return {"total_services": count(Service), "operational_services": count(Service, Service.status == "operational"), "active_incidents": count(Incident, Incident.status != "resolved"), "open_tasks": count(Task, Task.status != "done"), "uptime": round(100 * (successful or 0) / total, 2) if total else None, "average_latency_ms": round(latency, 1) if latency is not None else None, "total_checks": total, "is_demo": user.is_demo}


@app.get("/api/activity")
def activities(limit: int = Query(20, ge=1, le=100), user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [activity_json(a) for a in db.scalars(select(Activity).where(Activity.owner_id == user.id).order_by(Activity.created_at.desc()).limit(limit))]


@app.get("/api/export")
def export(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"schema_version": 1, "exported_at": iso(now()), "user": user_json(user), "services": services(user, db), "incidents": incidents(user, db), "tasks": tasks(user, db), "checks": [check_json(c) for c in db.scalars(select(Check).where(Check.owner_id == user.id).order_by(Check.checked_at))], "activity": [activity_json(a) for a in db.scalars(select(Activity).where(Activity.owner_id == user.id).order_by(Activity.created_at))]}


@app.get("/api/public/status/{workspace_slug}")
def public_status(workspace_slug: str, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.workspace_slug == workspace_slug))
    if user is None or (user.is_demo and user.created_at.replace(tzinfo=now().tzinfo) < now() - timedelta(hours=settings.demo_hours)):
        raise HTTPException(404, "Status page not found.")
    public_services = db.scalars(select(Service).where(Service.owner_id == user.id, Service.is_public.is_(True)).order_by(Service.created_at)).all()
    fields = ("id", "name", "description", "status", "last_checked", "uptime", "is_sample")
    return {"workspace_name": user.name, "workspace_slug": user.workspace_slug, "is_demo": user.is_demo, "updated_at": iso(max((s.last_checked for s in public_services if s.last_checked), default=None)), "services": [{key: value for key, value in service_json(db, s).items() if key in fields} for s in public_services]}
