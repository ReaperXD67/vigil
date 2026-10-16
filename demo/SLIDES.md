# Vigil presentation

Twelve widescreen slides for the capstone presentation. The editable PowerPoint includes native architecture and CI/GitOps diagrams, native tables, and speaker notes with sources. The PDF and 1920×1080 slide PNGs preserve the reviewed layout.

## Files

- [PowerPoint](presentation.pptx)
- [PDF](slides.pdf)
- [Slide PNGs](slides/)
- [Source builder](deck-source/build.mjs) and [release evidence inputs](deck-source/release.json)

Geist is the project typeface. Install Geist when editing the PowerPoint on a computer that does not have it. The PDF and images do not require font installation.

## Presenter notes

### 01. Vigil

I built Vigil as an original reliability workspace. It combines real public HTTPS checks with incident response, dependency analysis, and recovery tasks. The public project and its delivery evidence are available in the repository. This presentation describes verified behavior and explicitly identifies the EKS gap.

Sources: [github.com/ReaperXD67/vigil](https://github.com/ReaperXD67/vigil), [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md)

### 02. Service health and response

The application organizes the response to a service problem. Registered workspaces can monitor approved public HTTPS endpoints. Public status pages expose only opted-in services and provide copyable SVG status badges with sample and stale-data labels. Incidents keep a factual timeline and connect to remediation tasks. JSON exports and deterministic Markdown postmortems preserve the work. The screenshot contains explicitly labeled demo telemetry.

Sources: [github.com/ReaperXD67/vigil](https://github.com/ReaperXD67/vigil), [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md)

### 03. Service dependency analysis

A declared connection identifies which service depends on an upstream service. Selecting a service follows the graph to count direct and indirect dependents at the shortest number of hops. Ownership checks keep every connection private. The server rejects self-connections, duplicate edges, and cycles, including concurrent opposite inserts. Production browser checks verified create, reload persistence, removal, and restoration of the original graph. Potential impact does not establish measured failure propagation or root cause.

Sources: [github.com/ReaperXD67/vigil](https://github.com/ReaperXD67/vigil), [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md)

### 04. Application architecture

This is the runtime request and data flow. Traefik terminates public HTTPS and routes the static React frontend and /api requests to their services. FastAPI replicas share PostgreSQL for users, sessions, services, incidents, and dependencies. A singleton worker schedules probes. The API and worker validate public destinations before an HTTPS check. PostgreSQL uses a local persistent volume on the EC2 host, so an off-host backup is necessary for host-loss recovery. All components and connectors in this diagram are editable PowerPoint objects.

Sources: [github.com/ReaperXD67/vigil](https://github.com/ReaperXD67/vigil), [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md)

### 05. Implementation stack

The stack separates product code from deployment. FastAPI uses SQLAlchemy and Alembic with PostgreSQL in production and isolated SQLite tests. React and TypeScript build with Vite and serve through a nonroot Nginx container. The interaction layer uses original WebGL geometry, Motion, GSAP, and Lenis with keyboard and reduced-motion controls. GitHub Actions builds and scans immutable images. Terraform and Helm reproduce the AWS and Kubernetes definitions.

Sources: [github.com/ReaperXD67/vigil](https://github.com/ReaperXD67/vigil), [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md)

### 06. Automated verification

The CI-verified source contains 128 automated checks: 94 backend tests, 24 frontend tests, and 10 offline AWS spending-guard tests. API cases include authentication, ownership, SSRF controls, graph cycles, cascade deletion, concurrent opposite inserts, and public-badge privacy and stale-data handling. Frontend tests cover API-client behavior, graph traversal, and particle projection. CI additionally applies and rolls back all PostgreSQL migrations, then checks actual container restart persistence through Nginx.

Sources: [github.com/ReaperXD67/vigil/actions/runs/38908236938](https://github.com/ReaperXD67/vigil/actions/runs/38908236938), [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md)

### 07. CI and security gates

A push to main runs backend tests, frontend build and tests, and PostgreSQL migrations. The container job waits for all three, builds the actual runtime images, starts the full Compose stack, verifies nonroot user IDs and persistence through a backend restart, and scans both images. Trivy v0.76.0 includes operating-system and runtime dependencies, fails on HIGH or CRITICAL findings including unfixed issues, and uses no vulnerability exclusions. Only successful gates publish full-commit-SHA images to GHCR. Zero matching findings describes the scan at that time, not a vulnerability-free guarantee.

Sources: [github.com/ReaperXD67/vigil/actions/runs/38908236938](https://github.com/ReaperXD67/vigil/actions/runs/38908236938), [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md), [github.com/ReaperXD67/vigil/blob/main/.github/workflows/ci.yml](https://github.com/ReaperXD67/vigil/blob/main/.github/workflows/ci.yml)

### 08. AWS Free plan deployment

The running public product uses one EC2 t3.small instance in Mumbai with K3s, a 20 GiB encrypted root volume, an Elastic IP, and SSM administration. The AWS Console capture shows the real Vigil VPC with public subnets in two availability zones and an Internet Gateway; the application still runs on one host. A guard requires the actual account plan to be FREE and ACTIVE with positive finite USD credit before provisioning or deployment. Paid accounts are rejected even if promotional credits remain. Temporary larger capacity supported monitoring and recovery, then returned to the budget host. The EKS source exists but EKS apply, node-group provisioning, and destroy evidence remain unverified because the authorization forbids upgrading the account or paid EKS services.

Sources: [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md), [github.com/ReaperXD67/vigil/blob/main/demo/evidence/aws-vpc-console.jpg](https://github.com/ReaperXD67/vigil/blob/main/demo/evidence/aws-vpc-console.jpg), [github.com/ReaperXD67/vigil/blob/main/AGENTS.md](https://github.com/ReaperXD67/vigil/blob/main/AGENTS.md), [github.com/ReaperXD67/vigil/blob/main/docs/DEPLOYMENT.md](https://github.com/ReaperXD67/vigil/blob/main/docs/DEPLOYMENT.md), [github.com/Nency-Ravaliya/devsecops-python/blob/main/GRADING.md](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/GRADING.md)

### 09. Kubernetes rollout and recovery

Production runs two backend replicas, two frontend replicas, and one scheduled worker. PostgreSQL migrations gate application rollout. A previous surge update exhausted headroom and mixed frontend assets across versions. The deployed fix uses Recreate for the frontend and zero-surge rolling updates for the API, trading a bounded frontend interruption for consistent assets and lower peak memory. A route error boundary handles failed lazy chunks and render exceptions. The bounded HPA load exercise on 15 October 2026 scaled from two to four replicas and naturally recovered to two. Six readiness samples on t3.small passed with 543 to 569 MiB memory available and unchanged restart counts. The 16 October application release subsequently passed health and database readiness with two API and two frontend replicas ready.

Sources: [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md), [github.com/ReaperXD67/vigil/blob/main/docs/OPERATIONS.md](https://github.com/ReaperXD67/vigil/blob/main/docs/OPERATIONS.md), [github.com/ReaperXD67/vigil/tree/main/helm/vigil](https://github.com/ReaperXD67/vigil/tree/main/helm/vigil)

### 10. GitOps with Argo CD

Argo CD reconciled a real Git promotion in an isolated preview namespace. The baseline Git revision dbe40442 used application images 49b1aa3. Commit 33f8e1f4e01e68a52922dcf4fd6f3e77edfe47af promoted both application images to the CI-verified dbe40442fc324ea1393e121a65887ee697131619. Automatic sync ran from 13:37:27 to 13:37:42 UTC on 16 October 2026 and finished Synced, Healthy, and Succeeded. No manual Helm deployment or manual sync performed the promotion. One API and one frontend replica became ready, with Alembic revision c5f6d1a2b390. The preview used an isolated database and did not change production's Helm ownership. Git revision and application-image revision are different identifiers.

Sources: [github.com/ReaperXD67/vigil](https://github.com/ReaperXD67/vigil), [github.com/ReaperXD67/vigil/tree/main/gitops](https://github.com/ReaperXD67/vigil/tree/main/gitops), [github.com/ReaperXD67/vigil/blob/main/demo/evidence/argocd-promoted.png](https://github.com/ReaperXD67/vigil/blob/main/demo/evidence/argocd-promoted.png), [github.com/ReaperXD67/vigil/commit/33f8e1f4e01e68a52922dcf4fd6f3e77edfe47af](https://github.com/ReaperXD67/vigil/commit/33f8e1f4e01e68a52922dcf4fd6f3e77edfe47af), [github.com/ReaperXD67/vigil/blob/main/demo/evidence/gitops-promoted.txt](https://github.com/ReaperXD67/vigil/blob/main/demo/evidence/gitops-promoted.txt), [github.com/Nency-Ravaliya/devsecops-python/blob/main/SUBMISSION.md](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/SUBMISSION.md)

### 11. Live observability

The fresh AWS capture on 16 October 2026 shows two healthy API targets, populated request-rate and p95-latency charts, and an HTTP 5xx ratio with a corrected 0 to 100 percent scale. Prometheus separately reported both API targets and the worker target UP with no scrape errors. The recorded query at 13:46:23 UTC returned approximately 0.413 requests per second and 9.61 milliseconds p95 latency; these are point-in-time demonstration observations, not performance guarantees. Dashboard configuration also includes checks, replica counts, and pod memory. Grafana used the corrected 512 MiB memory limit. Monitoring ran as a bounded private exercise on temporary capacity, accessible through an SSM tunnel. Continuous Grafana hosting is not promised.

Sources: [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md), [github.com/ReaperXD67/vigil/blob/main/demo/evidence/grafana-live.png](https://github.com/ReaperXD67/vigil/blob/main/demo/evidence/grafana-live.png), [github.com/ReaperXD67/vigil/blob/main/demo/evidence/monitoring-live.json](https://github.com/ReaperXD67/vigil/blob/main/demo/evidence/monitoring-live.json), [github.com/ReaperXD67/vigil/blob/main/monitoring/README.md](https://github.com/ReaperXD67/vigil/blob/main/monitoring/README.md)

### 12. Lessons and remaining limits

The implementation taught three concrete lessons. Small hosts require control of rollout peak memory, not just steady-state resource requests. The application must preserve session and database state across restarts and provide recovery when asset loading fails. Evidence should distinguish source configuration, a successful CI run, a deployed image, and an observed user workflow. EKS provisioning and teardown remain the explicit rubric gap. Product limitations include a single host, finite Free-plan credits, no email recovery or team invitations, and deterministic rather than AI-generated postmortems. The live demo and public repository allow the grader to inspect the actual system.

Sources: [github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md](https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md), [github.com/ReaperXD67/vigil](https://github.com/ReaperXD67/vigil), [github.com/Nency-Ravaliya/devsecops-python/blob/main/GRADING.md](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/GRADING.md)

## Rebuild

Requires the Codex-provided Artifact Tool runtime and the frontend font dependency after `npm ci` in `frontend/`. Set `VIGIL_ARTIFACT_MODULES`, `VIGIL_PRESENTATION_SKILL`, and `VIGIL_RUNTIME_PYTHON` to the workspace dependency paths, then run `node demo/deck-source/build.mjs` with that runtime's Node executable. Private drafts and checks stay in ignored `artifacts/deck-build/`.
