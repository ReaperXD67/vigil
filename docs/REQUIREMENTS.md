# Capstone requirements and evidence

Vigil is an original service-reliability application developed against the [Python capstone](https://github.com/Nency-Ravaliya/devops-heros/tree/main/session21-python). This ledger incorporates the newer [submission guide](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/SUBMISSION.md) and [grading rubric](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/GRADING.md), including the presentation and GitOps demonstration.

Evidence was refreshed on **16 October 2026**. A source file, green CI run, deployed image, and observed workflow establish different things. The [verification record](VERIFICATION.md) preserves those distinctions; this table does not predict a grade.

| Area | Implementation and evidence | Limits |
| --- | --- | --- |
| M1 Application | Python/FastAPI CRUD, PostgreSQL, three Alembic migrations, responsive React UI, real HTTPS probes, incidents, tasks, private dependency graphs, public status and SVG badges. [API](../backend/API.md), [live app](https://vigil.13-127-163-58.sslip.io) | Demo measurements are labeled sample data; dependency impact is not proven causality. |
| M2 Tests | [Run 38908236938](https://github.com/ReaperXD67/vigil/actions/runs/38908236938): **94 backend + 24 frontend + 10 spending-guard tests**, builds, PostgreSQL migration/rollback and integration checks. Isolated test databases. | Counts are tied to application revision `dbe40442fc324ea1393e121a65887ee697131619`. |
| M3 Git | [Public repository](https://github.com/ReaperXD67/vigil), more than ten meaningful commits, dependency/secret/state ignores, [history capture](assets/github-history.png), [actual push](../demo/evidence/ci-push.txt) | A form receipt is not claimed. |
| M4 Containers | Both nonroot images built; actual Compose startup and restart persistence passed in CI. Local `docker compose up --build -d --wait` passed with three healthy services, UIDs 10001/101, and 12 database tables. [Output](../demo/evidence/compose-verification.txt), [localhost:3000](../demo/evidence/compose-localhost.png) | Local API uses port 8001 to preserve the separate development server on 8000. Canonical stack: `compose.yaml`. |
| M5 CI/CD | A real push triggered all four passing jobs; SHA images publish only after tests, integration and scans. [CI](https://github.com/ReaperXD67/vigil/actions/runs/38908236938), [workflow](../.github/workflows/ci.yml), [video](../demo/VIDEO.md) | Production deployment is operator-triggered. Argo automatically reconciles only the separate preview. |
| M6 Security | Both Trivy scans passed the HIGH/CRITICAL gate with no exclusions. [Reports and interpretation](../demo/VIDEO.md#evidence-and-honesty), [security boundaries](../SECURITY.md) | A clean scan is a point-in-time result, not proof that no vulnerability exists. |
| M7 Infrastructure | Guarded EC2 Terraform plan/apply, VPC with two public subnets in separate AZs, HTTPS, example variables, static EC2/EKS validation. [Console](../demo/evidence/aws-vpc-console.jpg), [plan](../demo/evidence/terraform-plan.txt), [source](../infra/README.md) | **EKS/node group not provisioned. Full production destruction not performed while retained for evaluation.** Terraform lives under `infra/`. |
| M8 Kubernetes | K3s, Helm, two API/two frontend replicas, singleton worker, ClusterIP services, ingress, migration hooks, probes, HPA. Earlier live scaling: 2 → 3 → 4 → 2. [Evidence](VERIFICATION.md), [Helm](../helm/README.md) | Single host; K3s is not EKS. Rollout settings constrain peak memory. |
| M9 Observability | Actual Prometheus application targets and populated Grafana panels during a bounded exercise. [Guide](../monitoring/README.md), [evidence](VERIFICATION.md), [video](../demo/VIDEO.md) | Temporary monitoring is removed after recording; continuous Grafana availability is not promised. |
| M10 Presentation | [Twelve-slide PPT](../demo/presentation.pptx), [PDF](../demo/slides.pdf), [walkthrough/provenance](../demo/VIDEO.md), technical README, actual Argo baseline and Git-triggered promotion. | Infrastructure exceptions are explicit. |

## GitOps evidence

The private Argo application reached `Synced` / `Healthy` at Git revision `dbe4044` with the older tested images. The [promotion push](../demo/evidence/gitops-push.txt) changed both image tags to `dbe40442fc324ea1393e121a65887ee697131619`. Argo automatically reconciled Git revision `33f8e1f4e01e68a52922dcf4fd6f3e77edfe47af` and returned `Synced` / `Healthy`, with a successful operation and no conditions. No manual application sync or Helm application deployment performed that promotion.

The controller is scoped to `vigil-preview`, with its own disposable database, resource quota, and Restricted Pod Security. Its Kubernetes role cannot manage production or read preview Secrets. The [GitOps guide](../gitops/README.md) describes that boundary and cleanup. Production remains owned by its Helm release.

## Submission boundary

The owner's explicit financial boundary is **AWS Free plan only; no account upgrade**. The deployment helper rejects paid accounts even when credits remain. EKS apply/destroy evidence cannot be supplied within that authorization, and an [actual console capture](../demo/evidence/aws-eks-not-provisioned.jpg) shows zero clusters. Finite credits or Free-plan expiry end hosting; perpetual free availability is not claimed.

The application is retained for evaluation. Temporary Argo/monitoring cleanup and returning to the smaller host are not equivalent to destroying the production Terraform stack. Full teardown remains an after-evaluation operation following backup. See the [submission handoff](../demo/SUBMISSION.md) for files, form status, and the deadline discrepancy.
