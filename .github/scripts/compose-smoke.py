"""Exercise the disposable Compose stack through its real frontend proxy.

Run from the repository root after `docker compose up --build --wait`.
Creates an isolated sample workspace and restarts this Compose project's backend
to verify database-backed task, dependency, and session persistence. No third-party URL probes.
"""

import http.cookiejar
import json
import os
import subprocess
import time
import urllib.error
import urllib.request


BASE_URL = os.environ.get("SMOKE_BASE_URL", "http://localhost:3000").rstrip("/")
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))


def request(path, method="GET", payload=None, expected=200):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE_URL + path,
        data=body,
        method=method,
        headers={"Content-Type": "application/json", "Origin": BASE_URL},
    )
    try:
        response = client.open(req, timeout=10)
    except urllib.error.HTTPError as error:
        raise AssertionError(f"{method} {path} returned {error.code}") from error
    with response:
        assert response.status == expected, f"{method} {path}: {response.status}"
        content = response.read().decode()
        if "application/json" in response.headers.get("Content-Type", ""):
            return json.loads(content)
        return content


def main():
    assert "<html" in request("/").lower(), "Frontend did not return HTML"
    assert request("/api/ready")["database"] == "ok"
    session = request("/api/auth/demo", "POST", {})
    assert session["user"]["is_demo"] is True
    upstream_id = request("/api/services")[0]["id"]
    service = request(
        "/api/services", "POST", {"name": "Container dependency smoke", "url": "https://example.com"}, 201
    )
    edge = request(
        "/api/dependencies", "POST", {"upstream_id": upstream_id, "service_id": service["id"]}, 201
    )

    task = request(
        "/api/tasks", "POST", {"title": "Verify container persistence", "priority": "high"}, 201
    )
    task_id = task["id"]
    updated = request(f"/api/tasks/{task_id}", "PUT", {"status": "done"})
    assert updated["status"] == "done"

    subprocess.run(["docker", "compose", "restart", "backend"], check=True)
    for attempt in range(60):
        try:
            request("/api/ready")
            break
        except (AssertionError, OSError):
            if attempt == 59:
                raise
            time.sleep(0.5)

    assert request("/api/auth/me")["user"]["id"] == session["user"]["id"]
    assert request(f"/api/tasks/{task_id}")["status"] == "done"
    assert request(f"/api/dependencies/{edge['id']}")["service_id"] == service["id"]
    exported = request("/api/export")
    assert exported["tasks"], "Workspace export lost persisted tasks"
    assert any(item["id"] == edge["id"] for item in exported["dependencies"])
    request(f"/api/tasks/{task_id}", "DELETE")
    assert all(item["id"] != task_id for item in request("/api/tasks"))
    request(f"/api/services/{service['id']}", "DELETE")
    assert all(item["id"] != edge["id"] for item in request("/api/dependencies"))
    assert "vigil_" in request("/api/metrics"), "Prometheus metrics were not proxied"
    request("/api/auth/logout", "POST", {})
    print("PASS: frontend, proxy, sample session, task CRUD, dependency persistence/cascade, restart persistence, export, metrics, logout")


if __name__ == "__main__":
    main()
