"""Exercise the upgrade path against existing data, not just an empty schema."""
import os
from pathlib import Path
import sqlite3
import subprocess
import sys


def test_migrations_preserve_existing_accounts_and_round_trip(tmp_path):
    path = tmp_path / "migration.db"
    environment = {**os.environ, "DATABASE_URL": f"sqlite:///{path}", "APP_ENV": "development"}
    directory = Path(__file__).resolve().parents[1]

    def alembic(*arguments):
        subprocess.run([sys.executable, "-m", "alembic", *arguments], cwd=directory, env=environment, check=True, capture_output=True, text=True)

    alembic("upgrade", "21a027e0b6ad")
    with sqlite3.connect(path) as db:
        db.execute("INSERT INTO users (id,email,name,password_hash,workspace_slug,is_demo,created_at) VALUES (?,?,?,?,?,?,?)", ("existing-user", "existing@example.com", "Existing account", None, "existing-workspace", 1, "2026-10-15 00:00:00"))
    alembic("upgrade", "head")
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT name,quota_revision FROM users WHERE id='existing-user'").fetchone() == ("Existing account", 0)
        assert db.execute("SELECT name FROM capacity_locks").fetchone() == ("workspaces",)
    alembic("check")
    alembic("downgrade", "base")
    alembic("upgrade", "head")
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM users").fetchone() == (0,)
        assert db.execute("SELECT COUNT(*) FROM capacity_locks").fetchone() == (1,)
