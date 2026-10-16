#!/usr/bin/env bash
# Bounded GitOps review. Run the AWS Free-plan guard locally first.
set -euo pipefail
umask 077
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
cd "$(dirname "$0")/.."
[[ ${VIGIL_TEMPORARY_REVIEW:-} == 1 ]] || { echo 'Set VIGIL_TEMPORARY_REVIEW=1 after reviewing the cleanup plan.' >&2; exit 2; }
awk '/MemTotal/ {exit !($2 >= 3500000)}' /proc/meminfo || { echo 'The temporary review requires at least 4 GiB host capacity.' >&2; exit 2; }
for namespace in argocd vigil-preview; do
  kubectl get namespace "$namespace" --ignore-not-found -o json | python3 -c 'import json,sys; raw=sys.stdin.read(); assert not raw.strip() or json.loads(raw).get("metadata",{}).get("labels",{}).get("app.kubernetes.io/part-of")=="vigil-gitops-review", "Refusing to adopt an existing unowned review namespace"'
done
kubectl apply -f gitops/preview-access.yaml
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace argocd app.kubernetes.io/part-of=vigil-gitops-review --overwrite
if ! kubectl -n vigil-preview get secret vigil-database >/dev/null 2>&1; then
  python3 - <<'PY' | kubectl create -f -
import json,secrets
password=secrets.token_hex(32)
print(json.dumps({"apiVersion":"v1","kind":"List","items":[
 {"apiVersion":"v1","kind":"Secret","metadata":{"name":"vigil-database","namespace":"vigil-preview"},"type":"Opaque","stringData":{"POSTGRES_PASSWORD":password}},
 {"apiVersion":"v1","kind":"Secret","metadata":{"name":"vigil-runtime","namespace":"vigil-preview"},"type":"Opaque","stringData":{"DATABASE_URL":f"postgresql+psycopg://vigil:{password}@vigil-postgres:5432/vigil"}}
]}))
PY
fi
helm upgrade --install vigil-preview-data ./helm/vigil-data --namespace vigil-preview --set storage.size=1Gi --wait --timeout 5m
helm upgrade --install argocd argo-cd --repo https://argoproj.github.io/argo-helm \
  --version 10.10.5 --namespace argocd -f gitops/argocd-values.yaml --wait --timeout 8m
# Fail if this controller accidentally obtained production privileges.
[[ $(kubectl auth can-i update deployments -n vigil --as=system:serviceaccount:argocd:argocd-application-controller) == no ]]
[[ $(kubectl auth can-i update deployments -n vigil-preview --as=system:serviceaccount:argocd:argocd-application-controller) == yes ]]
[[ $(kubectl auth can-i get secrets -n vigil-preview --as=system:serviceaccount:argocd:argocd-application-controller) == no ]]
kubectl apply -f gitops/application.yaml
echo 'GitOps reconciliation started. Use scripts/deploy-gitops-status.sh and private SSM forwarding; see gitops/README.md.'
