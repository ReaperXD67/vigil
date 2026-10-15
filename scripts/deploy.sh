#!/usr/bin/env bash
# Run on the K3s host after CI publishes both images for the requested SHA.
set -euo pipefail
umask 077
if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <40-character commit SHA> <public hostname> [ACME contact email]" >&2
  exit 2
fi
IMAGE_TAG=$1
PUBLIC_HOST=$2
ACME_EMAIL=${3:-}
[[ "$IMAGE_TAG" =~ ^[a-f0-9]{40}$ ]] || { echo 'Use a full Git commit SHA.' >&2; exit 2; }
[[ "$PUBLIC_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || { echo 'Invalid public hostname.' >&2; exit 2; }
[[ -z "$ACME_EMAIL" || "$ACME_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo 'Invalid ACME email.' >&2; exit 2; }
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$PROJECT_ROOT"
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
NAMESPACE=vigil
STORAGE_CLASS=${STORAGE_CLASS:-local-path}
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Generate once. Secret JSON travels only through pipes, never command arguments,
# shell tracing, Terraform state or Git. Preserve credentials across upgrades.
if ! kubectl -n "$NAMESPACE" get secret vigil-database >/dev/null 2>&1; then
  python3 - <<'PY' | kubectl apply -f -
import json, secrets
password = secrets.token_hex(32)
items = [
 {"apiVersion":"v1", "kind":"Secret", "metadata":{"name":"vigil-database","namespace":"vigil"},"type":"Opaque","stringData":{"POSTGRES_PASSWORD":password}},
 {"apiVersion":"v1", "kind":"Secret", "metadata":{"name":"vigil-runtime","namespace":"vigil"},"type":"Opaque","stringData":{"DATABASE_URL":f"postgresql+psycopg://vigil:{password}@vigil-postgres:5432/vigil"}}
]
print(json.dumps({"apiVersion":"v1","kind":"List","items":items}))
PY
fi
kubectl -n "$NAMESPACE" get secret vigil-runtime >/dev/null
helm upgrade --install vigil-data ./helm/vigil-data --namespace "$NAMESPACE" --set-string storage.className="$STORAGE_CLASS" --wait --timeout 5m
kubectl -n "$NAMESPACE" rollout status statefulset/vigil-postgres --timeout=180s

helm repo add jetstack https://charts.jetstack.io --force-update
helm repo update jetstack
helm upgrade --install cert-manager jetstack/cert-manager --version v1.21.2 --namespace cert-manager --create-namespace --set crds.enabled=true --wait --timeout 5m
ACME_EMAIL="$ACME_EMAIL" python3 - <<'PY' | kubectl apply -f -
import json,os
acme={"server":"https://acme-v02.api.letsencrypt.org/directory","privateKeySecretRef":{"name":"letsencrypt-account-key"},"solvers":[{"http01":{"ingress":{"ingressClassName":"traefik"}}}]}
if os.environ["ACME_EMAIL"]:
    acme["email"]=os.environ["ACME_EMAIL"]
print(json.dumps({"apiVersion":"cert-manager.io/v1","kind":"ClusterIssuer","metadata":{"name":"letsencrypt"},"spec":{"acme":acme}}))
PY
helm upgrade --install vigil ./helm/vigil --namespace "$NAMESPACE" \
  --set-string backend.tag="$IMAGE_TAG" --set-string frontend.tag="$IMAGE_TAG" \
  --set ingress.enabled=true --set ingress.tls=true --set-string ingress.host="$PUBLIC_HOST" \
  --set-string env.ALLOWED_ORIGINS="https://$PUBLIC_HOST" \
  --atomic --wait --timeout 8m
kubectl -n "$NAMESPACE" wait --for=condition=Ready certificate/vigil-tls --timeout=300s
curl --fail --retry 5 --retry-delay 3 "https://$PUBLIC_HOST/health"
curl --fail --retry 5 --retry-delay 3 "https://$PUBLIC_HOST/ready"
printf '\nVigil is serving https://%s at commit %s\n' "$PUBLIC_HOST" "$IMAGE_TAG"
