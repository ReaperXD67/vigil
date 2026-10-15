from datetime import timedelta

import pytest
from sqlalchemy import select

from app import database
from app.config import settings
from app.main import app
from app.models import SessionToken, User, now
from app.probe import ProbeResult, UnsafeTarget
from app.security import COOKIE_NAME, limiter


def test_health_readiness_metrics(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/api/ready").json() == {"status": "ready", "database": "ok"}
    assert "vigil_http_requests_total" in client.get("/metrics").text
    assert "vigil_http_request_duration_seconds_bucket" in client.get("/metrics").text


@pytest.mark.parametrize("path", ["/api/auth/me", "/api/services", "/api/incidents", "/api/tasks", "/api/stats", "/api/export", "/api/activity"])
def test_auth_required(client, path):
    assert client.get(path).status_code == 401


def test_registration_session_and_login(registered):
    client = registered
    user = client.get("/api/auth/me").json()["user"]
    assert user["email"] == "avery@example.com" and not user["is_demo"]
    token = client.cookies.get(COOKIE_NAME)
    with database.SessionLocal() as db:
        account = db.scalar(select(User))
        session = db.scalar(select(SessionToken))
        assert account.password_hash.startswith("scrypt$")
        assert "long-valid-password" not in account.password_hash
        assert token not in session.token_hash
    assert client.post("/api/auth/logout").json() == {"ok": True}
    assert client.get("/api/auth/me").status_code == 401
    bad = client.post("/api/auth/login", json={"email": user["email"], "password": "wrong"})
    assert bad.status_code == 401
    good = client.post("/api/auth/login", json={"email": user["email"], "password": "long-valid-password"})
    assert good.status_code == 200
    assert client.cookies.get(COOKIE_NAME) != token


def test_registration_rejects_weak_and_duplicate(registered):
    client = registered
    assert client.post("/api/auth/register", json={"name": "B", "email": "b@example.com", "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={"name": "A", "email": "AVERY@example.com", "password": "long-valid-password"}).status_code == 409


def test_expired_session(client):
    client.post("/api/auth/demo")
    with database.SessionLocal() as db:
        session = db.scalar(select(SessionToken))
        session.expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_demo_data_honest_and_reusable(demo):
    first = demo.get("/api/auth/me").json()["user"]
    second = demo.post("/api/auth/demo").json()["user"]
    assert first["id"] == second["id"]
    services = demo.get("/api/services").json()
    assert {s["name"] for s in services} == {"Edge API", "Authentication", "Event pipeline", "Dashboard"}
    assert all(s["is_sample"] for s in services)
    assert demo.get("/api/stats").json()["is_demo"] is True
    assert demo.post(f"/api/services/{services[0]['id']}/check").status_code == 403


def test_workspace_isolation_and_foreign_relationships(demo):
    client = demo
    service = client.get("/api/services").json()[0]
    incident = client.get("/api/incidents").json()[0]
    task = client.get("/api/tasks").json()[0]
    client.cookies.clear()
    second = client.post("/api/auth/demo").json()["user"]
    for resource, item in [("services", service), ("incidents", incident), ("tasks", task)]:
        assert client.get(f"/api/{resource}/{item['id']}").status_code == 404
        assert client.delete(f"/api/{resource}/{item['id']}").status_code == 404
        assert client.put(f"/api/{resource}/{item['id']}", json={"description": "Cross-account edit"}).status_code == 404
    assert client.get(f"/api/services/{service['id']}/checks").status_code == 404
    assert client.post("/api/incidents", json={"title": "Foreign", "service_id": service["id"]}).status_code == 404
    assert client.post("/api/tasks", json={"title": "Foreign", "incident_id": incident["id"]}).status_code == 404
    assert client.get("/api/export").json()["user"]["id"] == second["id"]
    assert service["id"] not in str(client.get("/api/export").json())


def test_empty_relationship_ids_are_validation_errors(registered):
    assert registered.post("/api/incidents", json={"title": "Invalid", "service_id": ""}).status_code == 422
    assert registered.post("/api/tasks", json={"title": "Invalid", "incident_id": ""}).status_code == 422


def test_timeline_limit_applies_to_status_patches(demo):
    from app.models import IncidentUpdate
    incident = demo.get("/api/incidents").json()[0]
    with database.SessionLocal() as db:
        for _ in range(198):
            db.add(IncidentUpdate(incident_id=incident["id"], message="Recorded event", status="investigating"))
        db.commit()
    assert demo.patch(f"/api/incidents/{incident['id']}", json={"status": "resolved"}).status_code == 409
    assert demo.post(f"/api/incidents/{incident['id']}/updates", json={"message": "Additional event"}).status_code == 409


def test_service_crud_and_public_opt_in(registered):
    client = registered
    slug = client.get("/api/auth/me").json()["user"]["workspace_slug"]
    created = client.post("/api/services", json={"name": "API", "url": "https://example.com"})
    assert created.status_code == 201
    service = created.json()
    assert service["status"] == "unknown" and service["uptime"] is None
    assert client.get(f"/api/public/status/{slug}").json()["services"] == []
    changed = client.put(f"/api/services/{service['id']}", json={"name": "Public API", "is_public": True}).json()
    assert changed["name"] == "Public API"
    public = client.get(f"/api/public/status/{slug}").json()["services"][0]
    assert public["name"] == "Public API"
    assert "url" not in public and "owner_id" not in public
    assert client.delete(f"/api/services/{service['id']}").json()["ok"]
    assert client.get(f"/api/services/{service['id']}").status_code == 404


def test_incident_lifecycle_postmortem_and_task(registered):
    client = registered
    service = client.post("/api/services", json={"name": "API", "url": "https://example.com"}).json()
    incident = client.post("/api/incidents", json={"title": "API unavailable", "service_id": service["id"], "severity": "critical", "description": "Errors increased after deploy."}).json()
    iid = incident["id"]
    assert incident["status"] == "investigating" and len(incident["updates"]) == 1
    updated = client.post(f"/api/incidents/{iid}/updates", json={"message": "Rollback started", "status": "identified"}).json()
    assert updated["status"] == "identified" and len(updated["updates"]) == 2
    task = client.post("/api/tasks", json={"title": "Add regression check", "incident_id": iid, "priority": "high"}).json()
    assert client.put(f"/api/tasks/{task['id']}", json={"status": "done"}).json()["status"] == "done"
    resolved = client.patch(f"/api/incidents/{iid}", json={"status": "resolved"}).json()
    assert resolved["resolved_at"] is not None
    report = client.get(f"/api/incidents/{iid}/postmortem").json()["markdown"]
    assert "Rollback started" in report and "[x] Add regression check" in report
    assert "Not documented" in report
    reopened = client.put(f"/api/incidents/{iid}", json={"status": "investigating"}).json()
    assert reopened["resolved_at"] is None
    assert client.delete(f"/api/incidents/{iid}").status_code == 200
    assert client.get(f"/api/tasks/{task['id']}").json()["incident_id"] is None
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 200


def test_service_delete_retains_incident(demo):
    incident = demo.get("/api/incidents").json()[0]
    assert demo.delete(f"/api/services/{incident['service_id']}").status_code == 200
    value = demo.get(f"/api/incidents/{incident['id']}").json()
    assert value["service_id"] is None and value["service_name"] is None


def test_checks_update_real_stats_and_reset_on_url_change(registered, monkeypatch):
    client = registered
    service = client.post("/api/services", json={"name": "API", "url": "https://example.com"}).json()
    monkeypatch.setattr("app.main.probe", lambda _: ProbeResult("operational", 75.5, 200))
    result = client.post(f"/api/services/{service['id']}/check")
    assert result.status_code == 200 and result.json()["is_sample"] is False
    stats = client.get("/api/stats").json()
    assert stats["total_checks"] == 1 and stats["uptime"] == 100 and stats["average_latency_ms"] == 75.5
    assert client.post(f"/api/services/{service['id']}/check").status_code == 429
    assert len(client.get(f"/api/services/{service['id']}/checks").json()) == 1
    changed = client.patch(f"/api/services/{service['id']}", json={"url": "https://www.example.com"}).json()
    assert changed["status"] == "unknown" and changed["uptime"] is None
    assert client.get("/api/stats").json()["total_checks"] == 0


def test_unsafe_dns_not_recorded_as_outage(registered, monkeypatch):
    service = registered.post("/api/services", json={"name": "API", "url": "https://example.com"}).json()
    def blocked(_):
        raise UnsafeTarget("Restricted network")
    monkeypatch.setattr("app.main.probe", blocked)
    assert registered.post(f"/api/services/{service['id']}/check").status_code == 422
    assert registered.get("/api/stats").json()["total_checks"] == 0


def test_export_contains_no_credentials(demo):
    exported = demo.get("/api/export").json()
    assert exported["schema_version"] == 1
    assert len(exported["checks"]) == 192
    assert len(exported["services"]) == 4
    text = str(exported)
    for forbidden in ("password_hash", "token_hash", "scrypt$", COOKIE_NAME):
        assert forbidden not in text


def test_empty_workspace_metrics_are_unknown(registered):
    value = registered.get("/api/stats").json()
    assert value["total_checks"] == 0 and value["uptime"] is None and value["average_latency_ms"] is None


def test_origin_csrf_body_and_null_validation(registered, monkeypatch):
    client = registered
    assert client.post("/api/tasks", json={"title": "Oops"}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/tasks", json={"title": "Oops"}, headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
    assert client.post("/api/tasks", content="x" * 33000).status_code == 413
    task = client.post("/api/tasks", json={"title": "Valid"}).json()
    assert client.put(f"/api/tasks/{task['id']}", json={"title": None}).status_code == 422
    assert client.put(f"/api/tasks/{task['id']}", json={"owner_id": "other"}).status_code == 422
    monkeypatch.setattr(settings, "app_env", "production")
    assert client.post("/api/tasks", json={"title": "Missing origin"}).status_code == 403
    assert client.post("/api/tasks", json={"title": "Allowed"}, headers={"Origin": "http://localhost:3000"}).status_code == 201


def test_demo_expiry_cleanup(client):
    first = client.post("/api/auth/demo").json()["user"]
    with database.SessionLocal() as db:
        user = db.get(User, first["id"])
        user.created_at = now() - timedelta(days=2)
        db.commit()
    client.cookies.clear()
    client.post("/api/auth/demo")
    with database.SessionLocal() as db:
        assert db.get(User, first["id"]) is None
    assert client.get(f"/api/public/status/{first['workspace_slug']}").status_code == 404


def test_rate_limit_bounded_and_auth_throttled(client):
    limiter.clear()
    for _ in range(12):
        client.post("/api/auth/login", json={"email": "none@example.com", "password": "wrong"})
    assert client.post("/api/auth/login", json={"email": "none@example.com", "password": "wrong"}).status_code == 429


def test_readiness_fails_closed(client):
    class BrokenDB:
        def execute(self, _):
            from sqlalchemy.exc import OperationalError
            raise OperationalError("unavailable", {}, Exception())
    from app.database import get_db
    app.dependency_overrides[get_db] = lambda: BrokenDB()
    try:
        assert client.get("/ready").status_code == 503
    finally:
        app.dependency_overrides.clear()
