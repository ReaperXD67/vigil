from datetime import timezone

from sqlalchemy import Integer, func, select

from .models import Check, IncidentUpdate, Service


def iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def user_json(user):
    return {"id": user.id, "name": user.name, "email": user.email, "is_demo": user.is_demo, "workspace_slug": user.workspace_slug, "created_at": iso(user.created_at)}


def uptime(db, service):
    total, successful = db.execute(select(func.count(Check.id), func.sum((Check.status == "operational").cast(Integer))).where(Check.service_id == service.id)).one()
    return round(100 * (successful or 0) / total, 2) if total else None


def service_json(db, service):
    return {"id": service.id, "name": service.name, "url": service.url, "description": service.description, "status": service.status, "last_checked": iso(service.last_checked), "latency_ms": service.latency_ms, "uptime": uptime(db, service), "is_public": service.is_public, "is_sample": service.is_sample, "created_at": iso(service.created_at)}


def check_json(check):
    return {"id": check.id, "service_id": check.service_id, "status": check.status, "latency_ms": check.latency_ms, "status_code": check.status_code, "error": check.error, "checked_at": iso(check.checked_at), "is_sample": check.is_sample}


def incident_json(db, incident):
    service = db.get(Service, incident.service_id) if incident.service_id else None
    updates = db.scalars(select(IncidentUpdate).where(IncidentUpdate.incident_id == incident.id).order_by(IncidentUpdate.created_at)).all()
    return {"id": incident.id, "title": incident.title, "description": incident.description, "severity": incident.severity, "status": incident.status, "service_id": incident.service_id, "service_name": service.name if service else None, "created_at": iso(incident.created_at), "updated_at": iso(incident.updated_at), "resolved_at": iso(incident.resolved_at), "is_sample": incident.is_sample, "updates": [{"id": x.id, "message": x.message, "status": x.status, "created_at": iso(x.created_at)} for x in updates]}


def task_json(task):
    return {"id": task.id, "title": task.title, "description": task.description, "status": task.status, "priority": task.priority, "incident_id": task.incident_id, "created_at": iso(task.created_at), "updated_at": iso(task.updated_at), "is_sample": task.is_sample}


def activity_json(item):
    return {"id": item.id, "type": item.type, "message": item.message, "created_at": iso(item.created_at), "is_sample": item.is_sample}
