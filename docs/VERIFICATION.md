# Verified delivery milestone

**Date:** 15 October 2026. **CI revision:** `fb0a8a71b0f6ef563eed206f3f98a54fe4577347`.

[GitHub Actions run 38700091001](https://github.com/ReaperXD67/vigil/actions/runs/38700091001) completed successfully. The source repository is public; its [captured history](assets/github-history.png) shows 11 meaningful commits through `9370cf8`, including this verified CI revision. This record describes completed checks; cloud deployment, EKS operation, and live Prometheus/Grafana remain pending.

## Automated application and runtime checks

| Check | Observed result |
| --- | --- |
| Python API suite | **73 tests passed** using isolated test databases |
| Frontend | Production TypeScript/Vite build and **7 helper tests passed** |
| PostgreSQL | Both Alembic migrations applied to a fresh database; authenticated task create/read/update/delete, readiness and metrics passed; rollback to base and reapplication passed |
| Container build | Backend and multistage frontend images built successfully |
| Compose runtime | PostgreSQL, backend and frontend started with healthy dependency ordering on the Linux CI runner |
| Nonroot execution | Runtime user IDs for both application containers verified to be nonzero |
| Frontend-to-API integration | Real Nginx proxy, demo session, service listing, task CRUD, export, metrics and logout passed |
| Persistence | Backend container restarted; the existing session and updated task survived and remained accessible |

The reusable runtime check is [compose-smoke.py](../.github/scripts/compose-smoke.py). CI starts the exact images that are subsequently scanned and published. PostgreSQL and its volume are disposed of after the test. Local Docker Desktop encountered a host startup failure, so this milestone does not claim that the local desktop Compose runtime passed.

## Container security and publishing

Trivy **v0.76.0** scanned operating-system packages and Python runtime dependencies. Both images had **zero HIGH or CRITICAL findings** with the scan database available during this run. The gate includes unfixed vulnerabilities, uses exit code 1 on findings, and contains no vulnerability exclusions. Findings at lower severities are outside this gate; this result is not a guarantee that the images contain no vulnerabilities.

An earlier run correctly blocked publication after finding 44 HIGH findings in the Debian runtime. The backend was changed to the official Python 3.12.15 Alpine runtime, updated its OS packages, retained CA certificates, and installed the pinned Python dependencies from compatible wheels. The new backend and frontend scans passed without weakening the policy. The actual reports are downloadable as the `container-security-reports` artifact in the [successful run](https://github.com/ReaperXD67/vigil/actions/runs/38700091001).

Published images:

```text
ghcr.io/reaperxd67/vigil-backend:fb0a8a71b0f6ef563eed206f3f98a54fe4577347
ghcr.io/reaperxd67/vigil-frontend:fb0a8a71b0f6ef563eed206f3f98a54fe4577347
```

Both tags were checked independently through anonymous registry authentication and manifest requests, which returned HTTP 200. Their public availability does not depend on a developer's local GitHub credentials. Publication occurred only after tests, runtime checks, and both scans passed.

## Browser verification

The connected local frontend/backend was exercised through the browser during this milestone:

- Registered a workspace, signed in, and confirmed session persistence after reload.
- Created a service and performed a real HTTPS check of `https://example.com`; the observed response was **HTTP 200 in 422 ms**. This is one measurement, not an uptime or latency guarantee.
- Opened an isolated demo, created a service, moved a recovery task, resolved an incident, and generated its structured postmortem.
- Downloaded workspace JSON, used command search, and checked public status-page privacy so private service information was not exposed.
- Reviewed desktop and mobile layouts. Seeded demo measurements and incidents were visibly labelled as sample data.
- Checked a 320 px viewport: document width remained 320 px with no horizontal overflow. Reduced-motion mode produced no JavaScript errors; Motion's expected reduced-motion warning was observed.

The final local frontend build, all 7 helper tests, and TypeScript unused-local checks also passed after the landing-page clone command was corrected to a valid shell continuation. These browser and local checks describe the delivery working tree; the separately linked CI run identifies its exact tested commit.

The screenshots below document the local interface, not a publicly hosted deployment. They contain illustrative demo data.

### Landing page

![Desktop Vigil landing page with animated service constellation](assets/landing.png)

### Workspace

![Vigil workspace showing clearly labelled sample services, incidents and recovery tasks](assets/workspace.png)

### Mobile

![Vigil landing page at mobile width](assets/mobile.png)

## Infrastructure validation and pending live evidence

The [infrastructure validation record](../infra/validation.txt) reports successful Terraform initialization without a backend, validation and formatting for both profiles; Helm lint/render; standard Kubernetes schema checks; monitoring chart rendering; and deployment-script syntax checks. Custom resource schema validation was explicitly skipped. These are static checks, not proof that cloud resources or dashboards are running.

Still pending: AWS account/credit confirmation and real provisioning; a public HTTPS URL; live Helm/Ingress/HPA behavior; Prometheus scrape target and populated Grafana panels; live failure-recovery exercises; backup restoration; and EKS teardown evidence. The [requirements ledger](REQUIREMENTS.md) maps these gaps to the capstone rubric. Use the [deployment guide](DEPLOYMENT.md) and [operations guide](OPERATIONS.md) to gather that evidence when the target environment is available.
