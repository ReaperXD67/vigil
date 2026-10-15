# Capstone requirements and evidence

Vigil is an original service-reliability application built against the [Session 21 Python capstone](https://github.com/Nency-Ravaliya/devops-heros/tree/main/session21-python) and its [grading rubric](https://github.com/Nency-Ravaliya/devops-heros/blob/main/session21-python/GRADING.md). Its domain is service checks, incident response, recovery tasks, and status communication. The TaskBoard reference supplies the assignment's requirements; Vigil's application is developed for this distinct domain.

This document separates implementation from operational proof. A manifest is not evidence that a workload ran. A configured workflow is not a successful CI run. A proposed AWS deployment is not proof of free-tier eligibility.

## Evidence ledger

The ledger is intentionally conservative during initial delivery. Replace pending entries only with an actual check result, run URL, or captured artifact. The project README carries the latest verified delivery status.

| Module | Required outcome | Implementation / evidence location | Verification still required |
| --- | --- | --- | --- |
| M1 Application (10) | FastAPI health endpoint; GET, POST, PUT, DELETE; PostgreSQL; Alembic; responsive frontend | `backend/`, `backend/API.md`, `frontend/`, `compose.yaml` | Successful API tests, PostgreSQL migration smoke, browser CRUD and responsive screenshots |
| M2 Tests (10) | At least 5 cases over 3 endpoints; isolated test database; Pytest configuration | `backend/tests/`; CI `API tests` job and JUnit artifact | Passing test count and execution output |
| M3 Git (5) | Public source, meaningful history, correct ignores | [Public repository](https://github.com/reaperxd67/vigil), `.gitignore` | At least 10 meaningful commits and history screenshot; no synthetic empty commits |
| M4 Docker (10) | Nonroot frontend/backend; multistage frontend; all 3 services start | Both Dockerfiles; `compose.yaml` | Both image builds and `docker compose up --build --wait`; browser screenshot |
| M5 CI/CD (15) | Main-push tests/build; both image builds; GHCR with SHA tags | [Quality workflow](../.github/workflows/ci.yml); [Actions](https://github.com/reaperxd67/vigil/actions) | Green run URL and both published package versions; deployment separately requires a configured target |
| M6 Security (5) | Trivy on both images; fail HIGH/CRITICAL; explain result | CI `containers` job; downloadable `container-security-reports` artifact | Actual scan result and finding explanation; the gate includes unfixed vulnerabilities |
| M7 Terraform (15) | Valid HCL; init/plan; VPC with 2 public subnets; EKS node group; tfvars example; destroy | Infrastructure implementation and its documentation | AWS account/credit confirmation, real plan/apply evidence, cluster screenshot, destroy completion |
| M8 Kubernetes (15) | Namespace, Helm, 2 replicas each, ClusterIP Services, `/` and `/api` Ingress | Kubernetes and Helm implementation | Successful Helm release, Running pods, Services, reachable Ingress; HPA metrics and scaling demonstration |
| M9 Observability (10) | Prometheus metrics, live scrape target, accessible Grafana, populated panel | Backend `/metrics`; monitoring implementation | Prometheus target `UP`, live Grafana panel screenshot |
| M10 Presentation (5) | Root README and commit-to-deployment walkthrough | [README](../README.md), this evidence map | Recorded or live full walkthrough with actual deployment change |

## Engineering additions

Vigil extends basic CRUD with isolated workspaces, sample sessions, service checks, incident timelines, remediation tasks, structured postmortems, export, and opt-in public status pages. The API contract describes their intended request shapes. Treat a feature as verified only after its implementation and tests have been run; the README must not present unfinished work as shipped.

CI also checks a clean PostgreSQL migration and rollback/reapplication, rather than relying exclusively on SQLite tests. Image publication requires both scans to pass, uses the exact commit SHA, and includes source/revision OCI labels. GitHub Action references are pinned to upstream commit SHAs.

## Two deployment purposes

The continuously hosted product and the EKS teaching demonstration have different cost profiles. A small hosting profile can keep the usable product available. EKS, worker nodes, load balancers, storage, and NAT resources may incur charges, so an EKS demonstration should have a bounded evaluation window and a verified cleanup procedure. Do not leave the classroom infrastructure running merely to preserve a screenshot.

Code for EKS, HPA, or Grafana does not meet the rubric's live-evidence requirements by itself. Record those items as pending until provisioned and observed. Free credits must be checked in the actual AWS account; this repository cannot guarantee zero charges.

## Capture an honest final walkthrough

1. Create an isolated workspace, add an incident and remediation task, update and delete a task, then demonstrate persistence after reload.
2. Show the FastAPI schema, a real PostgreSQL table, and passing tests.
3. Commit a small useful change; show that commit's GitHub Actions run, both Trivy reports, and both matching GHCR tags.
4. Show Terraform plan/apply evidence, the VPC/EKS resources, Helm release, pods, Services, and Ingress.
5. Generate controlled traffic; show HPA and live Prometheus/Grafana metrics. Identify sample application data visibly.
6. Run the isolated broken-image and broken-Service exercises, diagnose them from events/endpoints, and restore the healthy workloads.
7. Destroy demonstration-only AWS resources and retain the successful cleanup evidence.

Capture screenshots without access keys, cookies, kubeconfig, database connection strings, billing identifiers, or private user data. Store evidence outside source control unless it is intentionally sanitized for public sharing.
