# Capstone requirements and evidence

Vigil is an original service-reliability application built against the [Session 21 Python capstone](https://github.com/Nency-Ravaliya/devops-heros/tree/main/session21-python) and its [grading rubric](https://github.com/Nency-Ravaliya/devops-heros/blob/main/session21-python/GRADING.md). Its domain is service checks, incident response, recovery tasks, and status communication. The TaskBoard reference supplies the assignment's requirements; Vigil's application is developed for this distinct domain.

This document separates implementation from operational proof. A manifest is not evidence that a workload ran. A configured workflow is not a successful CI run. A proposed AWS deployment is not proof of free-tier eligibility.

## Evidence ledger

Recorded on **15 October 2026**. Final visual/dependency revision `49b1aa3fc58f5327b3adc79d6760244c95435052` passed all four jobs in [run 38739998103](https://github.com/ReaperXD67/vigil/actions/runs/38739998103), including graph persistence, 24 frontend tests, and both strict scans; its images are anonymously pullable. The public baseline remains `29a6eca958bb42e20daad70d1bd90256630b8449` until the final rollout recorded in [verification details](VERIFICATION.md). The main README carries the latest deployed revision.

| Module | Required outcome | Verified evidence / implementation | Remaining evidence |
| --- | --- | --- | --- |
| M1 Application (10) | FastAPI health; GET/POST/PUT/DELETE; PostgreSQL; Alembic; responsive frontend | API/PostgreSQL CI passed; local service/incident/task/dependency browser workflows and desktop/mobile review passed. Public HTTPS baseline passed authenticated CRUD and isolation checks. [API contract](../backend/API.md), [browser evidence](VERIFICATION.md#browser-verification) | Final dependency revision still needs deployment and public workflow verification |
| M2 Tests (10) | At least 5 cases over 3 endpoints; isolated test DB; Pytest configuration | **86 API tests passed**, using isolated test databases; separate PostgreSQL smoke includes graph cycles and cascade deletion. Final CI also passed **10 offline financial-guard tests** and **24 frontend tests**: seven API-client/session/error-handling, six graph, eleven geometry/projection cases | No remaining test-count requirement; retain exact-revision artifacts for presentation |
| M3 Git (5) | Public source, meaningful history, correct ignores | [Public repository](https://github.com/reaperxd67/vigil), **15 meaningful commits** through `49b1aa3`, `.gitignore`; earlier [captured history](assets/github-history.png) and [current history](https://github.com/ReaperXD67/vigil/commits/main/) | No remaining history-count requirement |
| M4 Docker (10) | Nonroot frontend/backend; multistage frontend; 3-service Compose | Both images built; Compose startup passed from those exact images; runtime UID checks and proxy/session/task/dependency persistence across backend restart passed, including graph export and cascade deletion | Local desktop Docker startup is not claimed; complete-stack execution was verified on the Linux CI runner |
| M5 CI/CD (15) | Main-push tests/build; both image builds; GHCR SHA tags | [Workflow](../.github/workflows/ci.yml) and [green final application run](https://github.com/ReaperXD67/vigil/actions/runs/38739998103); both complete-SHA image tags published and anonymously pullable. Baseline images deployed through Helm to public AWS K3s | Final revision rollout and recorded commit-to-cloud walkthrough; deployment is operator-triggered, not an automatic CI deployment claim |
| M6 Security (5) | Trivy on both images; fail HIGH/CRITICAL; explain result | Both Trivy **v0.76.0** scans passed with **0 HIGH/CRITICAL findings**; no exclusions and unfixed findings remain included. Download `container-security-reports` from the run; [interpretation](VERIFICATION.md#container-security-and-publishing) | Re-scan future revisions; a clean scan does not guarantee absence of vulnerabilities |
| M7 Terraform (15) | Valid HCL; init/plan; VPC with 2 public subnets; EKS node group; example variables; destroy | [EC2/EKS source](../infra/README.md); both profiles passed init without backend, validate, and formatting. EC2 Free-plan preflight, plan/apply, public host and HTTPS are verified. Safe [EC2](../infra/ec2/terraform.tfvars.example)/[EKS](../infra/eks/terraform.tfvars.example) examples and [static validation](../infra/validation.txt) | **EKS-specific apply, two-subnet VPC/node-group screenshot and destroy remain unverified.** The paid EKS opt-in stays disabled |
| M8 Kubernetes (15) | Namespace, Helm, 2 replicas each, ClusterIP Services, `/` and `/api` Ingress; HPA | [Namespace](../k8s/namespace.yaml), [Helm charts](../helm/README.md); live public K3s/Helm/Ingress verified. A bounded load exercise observed API HPA **2 → 3 → 4 → 2**, including natural recovery; broken-image/Service exercises recovered and their namespace was removed | Final feature rollout; K3s evidence does not establish an EKS deployment |
| M9 Observability (10) | Prometheus metrics, live scrape target, Grafana, populated panel | Optional stack ran on a temporary 4 GiB host: application `up=1`, real counters and latency histogram, and an eight-panel Vigil dashboard. [Real screenshot and limitations](VERIFICATION.md#captured-live-grafana-dashboard) preserved. Monitoring removed and public host restored to t3.small with HTTPS readiness verified | Continuous Grafana hosting is not promised. Post-capture memory/axis source corrections were validated statically, not rerun live |
| M10 Presentation (5) | Root README and commit-to-deployment walkthrough | [README](../README.md), [verification record](VERIFICATION.md), deployment and operations guides. Temporary monitoring/capacity/tunnel cleanup verified | Recorded/live walkthrough of the final deployment; EKS gaps must stay explicit |

## Engineering additions

Vigil extends basic CRUD with isolated workspaces, sample sessions, service checks, incident timelines, remediation tasks, structured postmortems, export, and opt-in public status pages. Its private dependency map adds direct/indirect impact analysis with shortest-hop labels, current service health, and incident severity. Server-side ownership, cycle rejection, serialized inserts, and cascades keep the graph consistent; tests cover concurrent opposite edges. Potential impact is explicitly distinguished from measured causality.

Browser verification covered the connected workflows, including a real HTTPS check from a registered workspace and dependency add/remove persistence. Seeded demo measurements remain visibly labelled as sample data. The interactive incident lab is a separately labeled simulation with playback, shareable state, and a deterministic Markdown timeline. See the verification record for the exact observed scope.

CI also checks a clean PostgreSQL migration and rollback/reapplication, rather than relying exclusively on SQLite tests. Image publication requires both scans to pass, uses the exact commit SHA, and includes source/revision OCI labels. GitHub Action references are pinned to upstream commit SHAs.

## Two deployment purposes

The public product runs on the small EC2/K3s profile. Monitoring and scaling exercises temporarily used a larger host; that capacity and optional stack were removed after evidence capture. HTTPS/database readiness passed again on t3.small. The separate EKS teaching profile remains unprovisioned because the user's Free-plan boundary does not authorize an account upgrade or paid EKS deployment.

Code for EKS, HPA, or Grafana does not meet the rubric's live-evidence requirements by itself. Live HPA and monitoring evidence exists for K3s; EKS-specific evidence remains pending. The guard verified the actual account's active Free plan and positive remaining credit, and no account upgrade was performed. Eligible usage consumes finite credit; expiry or exhaustion bounds availability. No claim of perpetual free hosting is made.

## Capture an honest final walkthrough

1. Create an isolated workspace, add an incident and remediation task, update and delete a task, then demonstrate persistence after reload.
2. Show the FastAPI schema, a real PostgreSQL table, and passing tests.
3. Commit a small useful change; show that commit's GitHub Actions run, both Trivy reports, and both matching GHCR tags.
4. Show Terraform plan/apply evidence, the VPC/EKS resources, Helm release, pods, Services, and Ingress.
5. Generate controlled traffic; show HPA and live Prometheus/Grafana metrics. Identify sample application data visibly.
6. Run the isolated broken-image and broken-Service exercises, diagnose them from events/endpoints, and restore the healthy workloads.
7. Destroy demonstration-only AWS resources and retain the successful cleanup evidence.

Capture screenshots without access keys, cookies, kubeconfig, database connection strings, billing identifiers, or private user data. Store evidence outside source control unless it is intentionally sanitized for public sharing.
