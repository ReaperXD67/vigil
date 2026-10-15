import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app import database
from app.config import settings
from app.main import app
from app.security import limiter


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = database.build_engine(f"sqlite:///{tmp_path / 'test.db'}")
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", factory)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "cookie_secure", False)
    limiter.clear()
    with TestClient(app) as value:
        yield value
    engine.dispose()


@pytest.fixture
def demo(client):
    response = client.post("/api/auth/demo", json={})
    assert response.status_code == 200, response.text
    return client


@pytest.fixture
def registered(client):
    response = client.post("/api/auth/register", json={"name": "Avery", "email": "avery@example.com", "password": "long-valid-password"})
    assert response.status_code == 201, response.text
    return client
