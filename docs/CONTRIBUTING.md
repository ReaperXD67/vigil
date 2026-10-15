# Contributing to Vigil

Vigil combines service checks, incident response, recovery tasks, and public status pages. Keep changes useful to a small engineering team and make every displayed operational value traceable to real checks or clearly labelled sample data.

## Run the complete local stack

Install Docker with Compose v2, start the Docker engine, and run from the repository root:

```sh
docker compose up --build --wait
```

Open [the application](http://localhost:3000) and [the API reference](http://localhost:8000/docs). PostgreSQL stores data in the `postgres-data` named volume. The backend waits for PostgreSQL, applies Alembic migrations, and becomes ready before the frontend starts.

```sh
docker compose logs -f backend
docker compose down
```

Stopping the stack retains its database. `docker compose down --volumes` permanently deletes the local database; use it only when you intend to reset all local workspaces.

The defaults are for local development. They bind application ports to `127.0.0.1`, use an explicitly local database password, and disable scheduled outbound checks. An internet deployment needs HTTPS, `APP_ENV=production`, `COOKIE_SECURE=true`, an exact HTTPS `ALLOWED_ORIGINS` value, and a unique database password. Set `TRUST_PROXY=true` only behind a trusted proxy that replaces forwarded headers. Keep `CHECK_WORKER_ENABLED=false` on replicated API processes unless a single dedicated worker is configured.

## Develop without containers

Use Python 3.12 and Node.js 22. From `backend`:

```sh
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The default database is local SQLite, useful for development. To exercise the production driver, supply `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE` before migrations and startup. Do not point tests at a database containing real data.

In a second terminal, from `frontend`:

```sh
npm ci
npm run dev
```

Use the Vite URL printed in the terminal. Read the [API contract](../backend/API.md) for request and response shapes.

## Verify a change

From `backend`:

```sh
python -m pytest -q
```

From `frontend`:

```sh
npm run build
npm test
```

From the repository root:

```sh
docker compose config --quiet
docker compose up --build --wait
```

The GitHub workflow additionally migrates a fresh PostgreSQL database, exercises authenticated task CRUD against it, and verifies migration rollback/reapplication. It builds both container images only after application checks pass. Trivy scans both images before any publishing; a HIGH or CRITICAL finding blocks publication. Main-branch images are tagged with the complete Git SHA. Pull requests run checks without publishing images.

## Submit a focused pull request

1. Create a branch with a descriptive name and make a coherent change.
2. Add meaningful tests for new API behavior, ownership rules, and failure cases. Validate UI changes at desktop and mobile widths, with keyboard navigation and reduced motion.
3. Update the main README and affected guides for significant changes. Distinguish implemented behavior, verified results, and planned work.
4. Use a commit message that describes the behavior, such as `Add incident resolution timestamps`, rather than `update`.
5. Open a pull request with actual check results and screenshots where useful.

Never commit secrets, database files, generated build output, or Terraform state. See [SECURITY.md](../SECURITY.md) for private vulnerability reporting and [REQUIREMENTS.md](REQUIREMENTS.md) for the capstone evidence map.
