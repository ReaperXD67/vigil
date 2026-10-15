# Vigil API

A Python service for monitoring public HTTPS endpoints, coordinating incidents, and tracking remediation work. FastAPI serves the JSON API; SQLAlchemy isolates each account's workspace; Alembic manages the relational schema. PostgreSQL is the deployment database, with SQLite available for local development and tests.

## Run locally

Use Python 3.11 or newer (the container uses 3.12). From `backend/`:

```powershell
uv venv .venv
uv pip sync --python .venv/Scripts/python.exe requirements-dev.txt
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On Linux/macOS, replace `.venv/Scripts/python.exe` with `.venv/bin/python`. Without uv, use `python -m venv .venv` followed by the environment's `python -m pip install -r requirements-dev.txt`.

Interactive OpenAPI documentation is at `http://127.0.0.1:8000/docs`. The frontend uses the same-origin `/api` prefix through its development/deployment proxy. The complete payload contract is in [API.md](API.md).

## Implemented workflows

- Register and sign in with an email, display name, and password. Sessions survive API restarts because token hashes live in the database. Logout revokes the token. Passwords use salted scrypt (`N=32768, r=8, p=3`); raw passwords and session tokens are never stored.
- Start an isolated demo with four services, 192 sample check records, an investigating incident, and remediation tasks. Repeated demo requests reuse the current demo session. Demo workspaces expire after 24 hours by default and cannot make external network probes.
- Add, edit, and remove services; run a real HTTPS header check; view recent history; opt individual services into a public status page. Registered workspaces start empty, with unknown health until a check runs.
- Record incident severity and timeline updates, resolve/reopen incidents, link tasks, and export a factual Markdown incident report with explicit placeholders for unrecorded root cause and prevention analysis.
- Create, edit, complete, and delete tasks. Export the authenticated workspace as JSON. All resource reads, edits, deletes, and relationships enforce account ownership.

Checks use `HEAD` and never follow redirects. A verified 2xx response under two seconds is operational; slower 2xx and 3xx/4xx responses are degraded; 5xx and connection/TLS failures are down. “Uptime” is the fraction of retained checks classified operational, **not** a time-weighted SLA or availability guarantee. No checks means unknown (`null`), not 100%. Changing a service URL resets its old check history so measurements from different targets are not combined.

## Configuration

Copy settings into environment variables or an untracked `.env` in this directory.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./vigil.db` | Use `postgresql+psycopg://USER:PASSWORD@HOST:5432/vigil` in deployments. |
| `APP_ENV` | `development` | `production` requires allowed Origin headers on mutations and secure cookies. Production never creates schema implicitly. |
| `ALLOWED_ORIGINS` | localhost ports 3000/5173, 127.0.0.1:5173 | Comma-separated exact browser origins, including the deployed HTTPS origin. |
| `COOKIE_SECURE` | `false` | Force HTTPS-only cookies; always enabled in production. |
| `SESSION_HOURS` | `24` | Registered session lifetime; at most ten sessions per account. |
| `DEMO_HOURS` | `24` | Demo workspace/session lifetime. |
| `MAX_DEMO_WORKSPACES` | `200` | Active demo capacity. Expired workspaces are deleted with their dependent rows. |
| `CHECK_WORKER_ENABLED` | `false` | Opt in to automatic checks on a **single** worker instance. |
| `CHECK_INTERVAL_SECONDS` | `300` | Requested interval, minimum 60 seconds; actual cadence also depends on queue size and endpoint response time. |

The worker scans at most 25 due, non-demo services per sweep, then waits 60 seconds. Manual checks work with the worker disabled. API instances should leave this disabled when a separate singleton worker is used. Set production origin and database configuration before startup; no application signing secret is required because sessions use random, database-backed tokens.

## Security and capacity boundaries

- Probes only permit HTTPS on port 443. URL credentials, local/internal hostnames, private/reserved/multicast IPs, IPv4-mapped and transition addresses are rejected. Every returned A/AAAA record must be public; failed validation in either address family fails closed. The socket connects to a validated numeric IP while TLS verifies the original hostname, preventing a second DNS lookup from enabling rebinding. DNS and network work share an eight-second deadline; response headers are capped at 16 KiB.
- Cookies are HttpOnly and SameSite=Lax. Mutations enforce configured origins and reject cross-site Fetch Metadata; production also rejects missing Origin. CLI clients must supply `Origin: https://YOUR_HOST` and a cookie jar. Bodies are capped at 32 KiB; schemas reject unexpected fields.
- In-process per-IP limits are 12 auth mutations, 60 other mutations, and 240 reads per minute; five new demos per minute; one probe per service per minute. Scrypt work is bounded to two concurrent operations. IPs come from the ASGI client address; forwarded headers must only be accepted from a trusted ingress. The image defaults to `--no-proxy-headers`.
- Limits are **per process**. Multiple API replicas require a shared ingress limiter; granular API limits otherwise multiply by replica count. Demo/workspace quotas are application-level safeguards, not a distributed billing/quota system.
- A workspace permits 25 services, 200 incidents, 500 tasks, and 200 timeline entries per incident. History retains at most 500 checks per service and 1,000 activity entries. API limits are designed for a small deployment, not an unbounded telemetry store.
- There is no email delivery, email verification, password recovery, team invitation, paid billing, SSO, or AI-generated root-cause claim in this version. A registered account proves possession of its session, not ownership of the monitored domain. Only monitor endpoints you are authorized to check.

## Operations and verification

```powershell
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m alembic check
```

The tests cover auth/session invalidation, workspace isolation, CRUD and relationship ownership, incident resolution/reopening, real-check aggregation with controlled network mocks, honest unknown/sample states, public opt-in, exports, CSRF, body/rate limits, readiness failure, demo expiration, unsafe DNS/IP destinations, TLS hostname pinning, and redirect refusal. Tests use temporary SQLite databases and do not contact external services.

`/health` is process liveness; `/ready` verifies database connectivity **and** the users table. Both also exist under `/api`. `/metrics` (and `/api/metrics`) exposes Prometheus request/error/check counters, process uptime, and an unlabelled request latency histogram without user URLs or identities. Counters reset when an API process restarts.

The non-root [Dockerfile](Dockerfile) applies `alembic upgrade head` before serving. In Kubernetes, run migrations in one pre-deployment job and override the API command to start Uvicorn directly. Migration upgrade → downgrade → upgrade and schema drift checks were validated on SQLite; PostgreSQL validation is configured in the repository CI job. Never run a destructive downgrade on a database with data you need.

Dependencies and transitive dependencies are pinned in `requirements.txt` and `requirements-dev.txt`. Refresh deliberately with `uv pip compile requirements.in --output-file requirements.txt` and `uv pip compile requirements-dev.in --output-file requirements-dev.txt`, then run the suite and migration checks.
