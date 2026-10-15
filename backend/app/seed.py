from datetime import timedelta

from .models import Activity, Check, Incident, IncidentUpdate, Service, Task, now


def seed_demo(db, user):
    current = now()
    services = []
    samples = [("Edge API", "Global request routing and API delivery", "operational", 42), ("Authentication", "Identity and session infrastructure", "operational", 68), ("Event pipeline", "Asynchronous events and background processing", "degraded", 1248), ("Dashboard", "Customer workspace and analytics", "operational", 91)]
    for index, (name, description, status, latency) in enumerate(samples):
        service = Service(owner_id=user.id, name=name, url="https://example.com", description=description, status=status, latency_ms=latency, last_checked=current - timedelta(minutes=2), is_public=True, is_sample=True, created_at=current - timedelta(days=7))
        db.add(service)
        db.flush()
        services.append(service)
        for sample in range(48):
            check_status = "degraded" if index == 2 and sample >= 44 else "operational"
            db.add(Check(owner_id=user.id, service_id=service.id, status=check_status, latency_ms=latency if check_status == "degraded" else 40 + ((sample * 7 + index * 13) % 65), status_code=200, checked_at=current - timedelta(minutes=2 + (47 - sample) * 30), is_sample=True))
    incident = Incident(owner_id=user.id, service_id=services[2].id, title="Elevated event processing latency", description="Sample incident: a queue backlog is delaying event delivery. This is a fictional scenario for exploring the workspace.", severity="major", status="investigating", created_at=current - timedelta(minutes=42), updated_at=current - timedelta(minutes=12), is_sample=True)
    db.add(incident)
    db.flush()
    db.add_all([
        IncidentUpdate(incident_id=incident.id, message="Sample alert: event delivery latency crossed the 1-second threshold.", status="investigating", created_at=current - timedelta(minutes=42)),
        IncidentUpdate(incident_id=incident.id, message="Sample investigation: checking consumer throughput and queue depth.", status="investigating", created_at=current - timedelta(minutes=12)),
        Task(owner_id=user.id, incident_id=incident.id, title="Investigate consumer backlog", description="Compare arrival rate against processing throughput.", priority="urgent", status="in_progress", is_sample=True),
        Task(owner_id=user.id, incident_id=incident.id, title="Verify recovery after mitigation", description="Observe queue depth and event latency for 15 minutes.", priority="high", status="todo", is_sample=True),
        Task(owner_id=user.id, title="Review the incident runbook", description="Document ownership and escalation steps.", priority="medium", status="todo", is_sample=True),
        Task(owner_id=user.id, title="Establish baseline health checks", description="Sample setup task completed.", priority="low", status="done", is_sample=True),
        Activity(owner_id=user.id, type="incident.created", message="Sample incident opened: Elevated event processing latency", created_at=current - timedelta(minutes=42), is_sample=True),
        Activity(owner_id=user.id, type="task.updated", message="Sample task started: Investigate consumer backlog", created_at=current - timedelta(minutes=24), is_sample=True),
        Activity(owner_id=user.id, type="incident.updated", message="Sample investigation update added to Event pipeline incident", created_at=current - timedelta(minutes=12), is_sample=True),
        Activity(owner_id=user.id, type="workspace.created", message="Your isolated demo workspace is ready. All seeded telemetry is sample data.", created_at=current, is_sample=True),
    ])
