# Review a real Vigil GitOps promotion

Argo CD reconciles the existing Vigil Helm chart into the disposable `vigil-preview` namespace. Production `vigil` remains owned by its original Helm release. This separation avoids two controllers trying to manage the same objects.

Verified on 16 October 2026: a pushed [GitOps change `33f8e1f`](https://github.com/ReaperXD67/vigil/commit/33f8e1f4e01e68a52922dcf4fd6f3e77edfe47af) promoted both images to tested revision `dbe40442fc324ea1393e121a65887ee697131619`. Argo automatically reconciled the preview to **Synced / Healthy**, completed its migration, and reported the new images without a manual sync or Helm application upgrade. The [recorded evidence](../demo/evidence/gitops-promoted.txt) and [screenshot](../demo/evidence/argocd-promoted.png) retain that result. The preview, database, controller, owned CRDs and private tunnel were then removed; continuous Argo hosting is not claimed.

The review is opt-in and temporary. The installer refuses existing namespaces without its ownership label; a prior owned review can be updated safely. The installer pins Argo CD chart `10.10.5` (application `v3.5.5`), disables admin/SSO/terminal access, and exposes only a private ClusterIP. Anonymous UI access is read-only and limited to the preview project. The controller has no production access, no cluster-wide role, and no permission to read preview Secrets. Its explicit destination and resource allowlist prevent it from creating cluster infrastructure or changing RBAC. The preview namespace enforces Kubernetes Restricted Pod Security to reject privileged workloads and host mounts. The bootstrap operator creates a separate database and random runtime Secrets before Argo's migration hook runs.

## Install and inspect

First verify the AWS Free plan from your workstation with `python scripts/deploy-terraform.py --profile scaler-lab --check-free-plan`. Review an in-place temporary resize to eligible 4 GiB capacity with the guarded Terraform helper; do not replace the instance or disk. Keep a database backup and a reviewed return-to-budget plan. GitOps and full monitoring are demonstrated sequentially to avoid combining their memory use.

From a checked-out repository on that host:

```sh
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
VIGIL_TEMPORARY_REVIEW=1 bash scripts/deploy-gitops.sh
bash scripts/deploy-gitops-status.sh
kubectl -n argocd port-forward service/argocd-server 18080:80
```

The UI is available on the host's loopback port. Use an authenticated SSM tunnel to reach it from a workstation; do not open an EC2 port or create a public ingress. HTTP is permitted only inside this private loopback/SSM path. The preview has one backend, one frontend and its own PostgreSQL; it is not the two-replica public production deployment. Its database is disposable and contains no production data. The preview has no public ingress, worker or monitoring resources.

## Promote through Git

1. Wait for `vigil-preview` to report both `Synced` and `Healthy` and record its Git revision and image tags.
2. Select a complete CI run whose backend and frontend images both passed tests and security scans. Change both tags in [preview/values.yaml](preview/values.yaml) to that full commit SHA.
3. Commit and push the values change. Do not run Helm against the preview application. Argo polls Git, runs the Alembic pre-sync migration, and reconciles the Deployments.
4. Record the new Git revision, `Synced`/`Healthy`, and deployed image tags. The image SHA identifies tested code; the later GitOps commit identifies the deployment decision. These are intentionally separate identifiers.

Automatic pruning and self-healing apply only to preview objects. Deleting every manifest is rejected. The application consumes only this public repository, so no GitHub access token is installed. Helm's pre-install/pre-upgrade hook is interpreted by Argo as a pre-sync migration; the separate database already exists before the hook starts. This preview demonstrates real GitOps promotion; it does not claim production is continuously managed by Argo CD.

## Remove the review

After saving the actual recording/evidence, stop the private port-forward/tunnel, then run:

```sh
VIGIL_TEMPORARY_REVIEW=1 bash scripts/deploy-gitops-cleanup.sh
kubectl -n vigil get deployment,pods,hpa
curl --fail https://YOUR_HOST/ready
```

Cleanup verifies ownership labels before deleting either disposable namespace, deletes the Application while its controller still runs, removes the preview database/PVC, uninstalls Argo, and removes only empty CRDs owned by that release. It never deletes production `vigil`. Finally apply the reviewed in-place return to `t3.small` using the Free-plan guard, and verify production readiness, replicas and memory again. The retained GitOps source and recording remain reproducible; continuous Argo operation after cleanup is not claimed.

Reference: [Argo CD namespace installation](https://argo-cd.readthedocs.io/en/stable/operator-manual/installation/), [declarative cluster configuration](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/), [Helm hooks](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/#helm-hooks), [pinned chart](https://github.com/argoproj/argo-helm/tree/argo-cd-10.10.5/charts/argo-cd).
