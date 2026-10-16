from datetime import timedelta
from xml.etree import ElementTree

import pytest

from app import database
from app.models import Service, User, now


def make_service(client, **values):
    return client.post("/api/services", json={"name": "Private origin", "url": "https://example.com/private-path", **values}).json()


def set_check(service_id, status, age=0):
    with database.SessionLocal() as db:
        service = db.get(Service, service_id)
        service.status = status
        service.last_checked = now() - timedelta(seconds=age)
        db.commit()


def badge(client):
    slug = client.get("/api/auth/me").json()["user"]["workspace_slug"]
    return client.get(f"/api/public/status/{slug}/badge.svg")


def test_badge_is_public_but_never_exposes_private_services(registered):
    assert registered.get("/api/services").headers["cache-control"] == "no-store"
    service = make_service(registered)
    set_check(service["id"], "down")
    response = badge(registered)
    assert "nothing shared" in response.text
    assert "Private origin" not in response.text and "example.com" not in response.text
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert response.headers["cache-control"] == "public, max-age=60, must-revalidate"
    assert "sandbox" in response.headers["content-security-policy"]
    ElementTree.fromstring(response.text)
    url = str(response.request.url)
    registered.cookies.clear()
    assert registered.get(url).status_code == 200


@pytest.mark.parametrize(("status", "age", "expected"), [
    ("operational", 0, "operational"),
    ("down", 0, "outage detected"),
    ("degraded", 0, "degraded"),
    ("unknown", 0, "unknown"),
    ("operational", 1800, "awaiting checks"),
])
def test_badge_reports_fresh_status_and_rejects_stale_health(registered, status, age, expected):
    service = make_service(registered, is_public=True)
    set_check(service["id"], status, age)
    assert f"Vigil: {expected}" in badge(registered).text


def test_unchecked_public_service_prevents_healthy_badge(registered):
    healthy = make_service(registered, is_public=True)
    set_check(healthy["id"], "operational")
    make_service(registered, name="New service", is_public=True)
    assert "awaiting checks" in badge(registered).text


def test_demo_badge_is_labeled_and_expires(demo):
    user = demo.get("/api/auth/me").json()["user"]
    assert "sample data" in badge(demo).text
    with database.SessionLocal() as db:
        db.get(User, user["id"]).created_at = now() - timedelta(days=2)
        db.commit()
    assert demo.get(f"/api/public/status/{user['workspace_slug']}/badge.svg").status_code == 404
    assert demo.get("/api/public/status/missing/badge.svg").status_code == 404
