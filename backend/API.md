# Vigil API contract

Base path: `/api`. JSON requests and responses; send cookies (`credentials: 'include'`). Mutations require a same-origin `Origin` header in production (browsers set it automatically). Authentication failures are `401`, validation errors `422`, ownership misses `404`. Errors have a `detail` field. Timestamps are UTC ISO 8601 strings. Resource IDs are UUID strings. No pagination wrapper: list routes return arrays.

## Authentication

- `POST /auth/demo` with `{}` → `{user}` and session cookie. Creates an isolated sample workspace. Demo sessions cannot probe external URLs. Demo data is explicitly labelled.
- `POST /auth/register` `{email,password,name}` → `{user}` and cookie. Password: 12–128 characters; name: 1–80. Registration creates an empty workspace.
- `POST /auth/login` `{email,password}` → `{user}` and cookie.
- `POST /auth/logout` → `{ok:true}`; clears cookie.
- `GET /auth/me` → `{user}`.

User: `{id,email,name,is_demo,workspace_slug,created_at}`.

## Services

- `GET /services` → `Service[]`.
- `POST /services` `{name,url,description?,is_public?}` → `Service` (`201`). HTTPS URLs only; demo services may use `https://example.com`.
- `GET /services/{id}` → `Service`.
- `PATCH|PUT /services/{id}` accepts any editable service fields → `Service`.
- `DELETE /services/{id}` → `{ok:true}`.
- `POST /services/{id}/check` `{}` → `Check`. Registered users only; performs a real, bounded, SSRF-safe HTTPS check.
- `GET /services/{id}/checks?limit=30` → `Check[]`, newest first, maximum 100.

Service: `{id,name,url,description,status,last_checked,latency_ms,uptime,is_public,is_sample,created_at}`. Status: `operational|degraded|down|unknown`. `last_checked`, `latency_ms`, `uptime` can be null if no checks. Uptime is a percentage computed from retained checks.

Check: `{id,service_id,status,latency_ms,status_code,error,checked_at,is_sample}`.

## Service dependencies

- `GET /dependencies` → `ServiceDependency[]`, oldest first.
- `POST /dependencies` `{upstream_id,service_id}` → `ServiceDependency` (`201`). Both services must belong to the authenticated workspace.
- `GET /dependencies/{id}` → `ServiceDependency`.
- `DELETE /dependencies/{id}` → `{ok:true}`.

ServiceDependency: `{id,upstream_id,service_id,is_sample,created_at}`. Direction is **upstream → dependent**: `service_id` depends on `upstream_id`. A connection declares a relationship; it never changes either service's health. The frontend computes potential downstream impact from this graph, not measured failure propagation or root cause.

Self-dependencies return `422`; duplicates, cycles, and the 100-connection workspace limit return `409`. Foreign or missing endpoints/connections return `404`. Graph validation and insertion share a serialized workspace transaction, including across API replicas. Deleting a service or workspace cascades its connections. Dependencies are private and included in authenticated JSON exports, never public status responses.

## Incidents

- `GET /incidents` → `Incident[]`, newest first.
- `POST /incidents` `{title,description?,severity?,service_id?}` → `Incident` (`201`). Defaults: severity `minor`, status `investigating`.
- `GET /incidents/{id}` → `Incident`.
- `PATCH|PUT /incidents/{id}` `{title?,description?,severity?,status?,service_id?}` → `Incident`.
- `DELETE /incidents/{id}` → `{ok:true}`.
- `POST /incidents/{id}/updates` `{message,status?}` → `Incident` (includes updated timeline).
- `GET /incidents/{id}/postmortem` → `{markdown}` (deterministic incident report, no LLM).

Incident: `{id,title,description,severity,status,service_id,service_name,created_at,updated_at,resolved_at,is_sample,updates}`. Severity: `critical|major|minor`. Status: `investigating|identified|monitoring|resolved`. Updates: `[{id,message,status,created_at}]`. Setting status `resolved` records `resolved_at`; reopening clears it.

## Tasks

- `GET /tasks` → `Task[]`, newest first.
- `POST /tasks` `{title,description?,priority?,status?,incident_id?}` → `Task` (`201`). Default: priority `medium`, status `todo`.
- `GET /tasks/{id}` → `Task`.
- `PATCH|PUT /tasks/{id}` accepts all editable task fields → `Task`.
- `DELETE /tasks/{id}` → `{ok:true}`.

Task: `{id,title,description,status,priority,incident_id,created_at,updated_at,is_sample}`. Status: `todo|in_progress|done`; priority: `low|medium|high|urgent`.

## Overview and portability

- `GET /stats` → `{total_services,operational_services,active_incidents,open_tasks,uptime,average_latency_ms,total_checks,is_demo}`. Metrics reflect retained checks; uptime/latency null with no data.
- `GET /activity?limit=20` → `[{id,type,message,created_at,is_sample}]`, newest first (maximum 100).
- `GET /export` → `{schema_version,exported_at,user,services,dependencies,incidents,tasks,checks,activity}`. Only the authenticated workspace; no password or session secrets.
- `GET /public/status/{workspace_slug}` → `{workspace_name,workspace_slug,is_demo,updated_at,services:[{id,name,description,status,last_checked,uptime,is_sample}]}`. Only services explicitly opted in via `is_public`; URLs/private data omitted. Unknown slug `404`.
- `GET /public/status/{workspace_slug}/badge.svg` → an embeddable SVG of aggregate public status, without names, URLs, or private service data. Fresh outages/degradation take precedence; otherwise any missing or older-than-three-worker-interval check (minimum five minutes) reports `awaiting checks`. Demo badges always say `sample data`. Unknown/expired demo slug returns `404`. Responses cache for 60 seconds; external image proxies can delay updates.
- `GET /health` and `GET /ready`: public liveness/readiness. Aliases at `/health` and `/ready`.
- `GET /metrics`: minimal Prometheus operational counters, with `/metrics` alias. No user identifiers or service URLs.

New demo workspaces seed four sample services (Edge API, Authentication, Event pipeline, Dashboard), three sample dependencies (Authentication → Edge API → Event pipeline → Dashboard), sample checks, an investigating incident, and remediation tasks. Existing workspaces are not backfilled with invented dependencies. The frontend must visibly label sample data. External service checks are synchronous and bounded to approximately 8 seconds; show a loading state.
