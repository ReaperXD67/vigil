# Capstone requirements and evidence

Vigil is an original service-reliability application built against the [Session 21 Python capstone](https://github.com/Nency-Ravaliya/devops-heros/tree/main/session21-python) and its [grading rubric](https://github.com/Nency-Ravaliya/devops-heros/blob/main/session21-python/GRADING.md). Its domain is service checks, incident response, recovery tasks, and status communication. The TaskBoard reference supplies the assignment's requirements; Vigil's application is developed for this distinct domain.

This document separates implementation from operational proof. A manifest is not evidence that a workload ran. A configured workflow is not a successful CI run. A proposed AWS deployment is not proof of free-tier eligibility.

## Evidence ledger

Verified on **15 October 2026** against commit `fb0a8a71b0f6ef563eed206f3f98a54fe4577347`. [CI run 38700091001](https://github.com/ReaperXD67/vigil/actions/runs/38700091001) passed all four jobs. [Verification details and screenshots](VERIFICATION.md) preserve the tested scope; the project README carries the latest delivery status.

| Module | Required outcome | Verified evidence / implementation | Remaining evidence |
| --- | --- | --- | --- |
| M1 Application (10) | FastAPI health; GET/POST/PUT/DELETE; PostgreSQL; Alembic; responsive frontend | API and PostgreSQL CI passed; browser service/incident/task workflows and desktop/mobile review passed. [API contract](../backend/API.md), [screenshots](VERIFICATION.md#browser-verification) | Public hosted application verification remains pending |
| M2 Tests (10) | At least 5 cases over 3 endpoints; isolated test DB; Pytest configuration | **73 API tests passed**, using isolated test databases; separate PostgreSQL smoke passed. JUnit artifact in the green run. **7 frontend tests** also passed | No remaining test-count requirement; retain artifacts/screenshots for presentation |
| M3 Git (5) | Public source, meaningful history, correct ignores | [Public repository](https://github.com/reaperxd67/vigil), **11 meaningful commits** at `9370cf8`, `.gitignore`; [captured history](assets/github-history.png) and [current history](https://github.com/ReaperXD67/vigil/commits/main/) | No remaining history-count requirement |
| M4 Docker (10) | Nonroot frontend/backend; multistage frontend; 3-service Compose | Both images built; Compose startup passed from those exact images; runtime UID checks and proxy/session/task persistence across backend restart passed | Local desktop Docker startup is not claimed; complete-stack execution was verified on the Linux CI runner |
| M5 CI/CD (15) | Main-push tests/build; both image builds; GHCR SHA tags | [Workflow](../.github/workflows/ci.yml) and [green run](https://github.com/ReaperXD67/vigil/actions/runs/38700091001); both complete-SHA image tags published and anonymously pullable | Commit-to-cloud deployment requires a configured, verified hosting target |
| M6 Security (5) | Trivy on both images; fail HIGH/CRITICAL; explain result | Both Trivy **v0.76.0** scans passed with **0 HIGH/CRITICAL findings**; no exclusions and unfixed findings remain included. Download `container-security-reports` from the run; [interpretation](VERIFICATION.md#container-security-and-publishing) | Re-scan future revisions; a clean scan does not guarantee absence of vulnerabilities |
| M7 Terraform (15) | Valid HCL; init/plan; VPC with 2 public subnets; EKS node group; example variables; destroy | [EC2/EKS source](../infra/README.md); both profiles passed init without backend, validate, and formatting. Safe [EC2](../infra/ec2/terraform.tfvars.example) and [EKS](../infra/eks/terraform.tfvars.example) variable examples; [validation record](../infra/validation.txt) | AWS account/credit confirmation, real plan/apply, VPC/EKS screenshot, destroy completion; no cloud resources are claimed live |
| M8 Kubernetes (15) | Namespace, Helm, 2 replicas each, ClusterIP Services, `/` and `/api` Ingress; HPA | [Namespace](../k8s/namespace.yaml), [Helm charts](../helm/README.md); Helm lint/render and standard-resource schema checks passed. Custom CRD schemas were skipped explicitly | Successful live Helm release, Running pods, Services, Ingress, HPA metrics/scaling; namespace application and isolated troubleshooting exercises |
| M9 Observability (10) | Prometheus metrics, live scrape target, Grafana, populated panel | API metrics verified through the Compose frontend proxy; [monitoring configuration](../monitoring/README.md) rendered successfully | Live Prometheus target `UP`, accessible Grafana and populated panel screenshot |
| M10 Presentation (5) | Root README and commit-to-deployment walkthrough | [README](../README.md), [verification record](VERIFICATION.md), deployment and operations guides | Recorded/live walkthrough including actual cloud deployment change and demonstration-only resource cleanup |

## Engineering additions

Vigil extends basic CRUD with isolated workspaces, sample sessions, service checks, incident timelines, remediation tasks, structured postmortems, export, and opt-in public status pages. Browser verification covered the connected workflows, including a real HTTPS check from a registered workspace. Seeded demo measurements remain visibly labelled as sample data. See the verification record for the exact observed scope.

CI also checks a clean PostgreSQL migration and rollback/reapplication, rather than relying exclusively on SQLite tests. Image publication requires both scans to pass, uses the exact commit SHA, and includes source/revision OCI labels. GitHub Action references are pinned to upstream commit SHAs.

## Two deployment purposes

The intended continuously hosted product and the EKS teaching demonstration have different cost profiles. A small hosting profile can keep the usable product available; public hosting is still pending at this verified milestone. EKS, worker nodes, load balancers, storage, and NAT resources may incur charges, so an EKS demonstration should have a bounded evaluation window and a verified cleanup procedure. Do not leave the classroom infrastructure running merely to preserve a screenshot.

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
