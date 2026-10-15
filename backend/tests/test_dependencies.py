from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app import database
from app.dependency_graph import has_path
from app.models import ServiceDependency, User


def service(client, name):
    response = client.post("/api/services", json={"name": name, "url": "https://example.com"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def add(client, upstream, downstream):
    return client.post("/api/dependencies", json={"upstream_id": upstream, "service_id": downstream})


def test_dependencies_require_authentication(client):
    assert client.get("/api/dependencies").status_code == 401
    assert add(client, "a" * 36, "b" * 36).status_code == 401
    assert client.delete("/api/dependencies/unknown").status_code == 401


def test_dependency_create_read_delete_and_export(registered):
    a, b = service(registered, "Database"), service(registered, "API")
    assert registered.get("/api/dependencies").json() == []
    created = add(registered, a, b)
    assert created.status_code == 201, created.text
    edge = created.json()
    assert edge["upstream_id"] == a and edge["service_id"] == b
    assert not edge["is_sample"] and edge["created_at"]
    assert registered.get(f"/api/dependencies/{edge['id']}").json() == edge
    assert registered.get("/api/dependencies").json() == [edge]
    assert registered.get("/api/export").json()["dependencies"] == [edge]
    assert registered.delete(f"/api/dependencies/{edge['id']}").json() == {"ok": True}
    assert registered.get(f"/api/dependencies/{edge['id']}").status_code == 404
    assert registered.get("/api/dependencies").json() == []
    activity = registered.get("/api/activity").json()
    assert {"dependency.created", "dependency.deleted"} <= {entry["type"] for entry in activity}


def test_duplicate_self_and_unknown_endpoints_are_rejected(registered):
    a, b = service(registered, "Identity"), service(registered, "Gateway")
    assert add(registered, a, a).status_code == 422
    assert add(registered, a, "missing-service".ljust(36, "0")).status_code == 404
    assert add(registered, a, b).status_code == 201
    duplicate = add(registered, a, b)
    assert duplicate.status_code == 409 and "already exists" in duplicate.json()["detail"]
    assert registered.post("/api/dependencies", json={"upstream_id": a, "service_id": b, "owner_id": "x"}).status_code == 422


def test_transitive_cycles_rejected_but_diamond_is_valid(registered):
    a, b, c, d = [service(registered, name) for name in ("A", "B", "C", "D")]
    for upstream, downstream in [(a, b), (a, c), (b, d), (c, d)]:
        assert add(registered, upstream, downstream).status_code == 201
    cycle = add(registered, d, a)
    assert cycle.status_code == 409 and "cycle" in cycle.json()["detail"]
    assert len(registered.get("/api/dependencies").json()) == 4


def test_removing_path_allows_previously_cyclic_dependency(registered):
    a, b, c = [service(registered, name) for name in ("A", "B", "C")]
    add(registered, a, b)
    edge = add(registered, b, c).json()
    assert add(registered, c, a).status_code == 409
    assert registered.delete(f"/api/dependencies/{edge['id']}").status_code == 200
    assert add(registered, c, a).status_code == 201


def test_foreign_endpoints_and_edges_are_not_disclosed(demo):
    old_services = demo.get("/api/services").json()
    old_edge = demo.get("/api/dependencies").json()[0]
    demo.cookies.clear()
    demo.post("/api/auth/demo")
    local = demo.get("/api/services").json()[0]["id"]
    foreign = old_services[0]["id"]
    assert add(demo, foreign, local).status_code == 404
    assert add(demo, local, foreign).status_code == 404
    assert demo.get(f"/api/dependencies/{old_edge['id']}").status_code == 404
    assert demo.delete(f"/api/dependencies/{old_edge['id']}").status_code == 404
    assert foreign not in str(demo.get("/api/dependencies").json())
    assert old_edge["id"] not in str(demo.get("/api/export").json())
    slug = demo.get("/api/auth/me").json()["user"]["workspace_slug"]
    assert "dependencies" not in demo.get(f"/api/public/status/{slug}").json()


def test_deleting_service_cascades_edges_in_both_directions(registered):
    a, b, c = [service(registered, name) for name in ("A", "B", "C")]
    add(registered, a, b)
    add(registered, b, c)
    preserved = add(registered, a, c).json()
    assert registered.delete(f"/api/services/{b}").status_code == 200
    assert registered.get("/api/dependencies").json() == [preserved]


def test_workspace_deletion_cascades_dependencies(demo):
    owner = demo.get("/api/auth/me").json()["user"]["id"]
    with database.SessionLocal() as db:
        assert len(db.scalars(select(ServiceDependency)).all()) == 3
        db.execute(delete(User).where(User.id == owner))
        db.commit()
        assert db.scalars(select(ServiceDependency)).all() == []


def test_demo_topology_is_labelled_sample(demo):
    edges = demo.get("/api/dependencies").json()
    names = {item["id"]: item["name"] for item in demo.get("/api/services").json()}
    assert len(edges) == 3 and all(edge["is_sample"] for edge in edges)
    assert {(names[e["upstream_id"]], names[e["service_id"]]) for e in edges} == {
        ("Authentication", "Edge API"), ("Edge API", "Event pipeline"), ("Event pipeline", "Dashboard")
    }


def test_dependency_capacity_is_bounded(registered, monkeypatch):
    monkeypatch.setattr("app.main.MAX_DEPENDENCIES", 2)
    a, b, c = [service(registered, name) for name in ("A", "B", "C")]
    assert add(registered, a, b).status_code == 201
    assert add(registered, b, c).status_code == 201
    response = add(registered, a, c)
    assert response.status_code == 409 and "limit" in response.json()["detail"]


def test_simultaneous_opposite_edges_cannot_create_cycle(registered):
    a, b = service(registered, "A"), service(registered, "B")
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda pair: add(registered, *pair).status_code, [(a, b), (b, a)]))
    assert sorted(results) == [201, 409]
    assert len(registered.get("/api/dependencies").json()) == 1


def test_database_rejects_self_edges(registered):
    a = service(registered, "A")
    owner = registered.get("/api/auth/me").json()["user"]["id"]
    with database.SessionLocal() as db:
        db.add(ServiceDependency(owner_id=owner, upstream_id=a, service_id=a))
        with pytest.raises(IntegrityError):
            db.commit()


def test_reachability_handles_disconnected_diamond_and_existing_cycle():
    edges = [("a", "b"), ("a", "c"), ("b", "d"), ("c", "d"), ("d", "b")]
    assert has_path(edges, "a", "d")
    assert not has_path(edges, "b", "a")
    assert not has_path(edges, "a", "unrelated")
    assert has_path(edges, "a", "a")
