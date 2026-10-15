#!/usr/bin/env bash
set -euo pipefail
umask 077
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
cd "$(dirname "$0")/.."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
if ! kubectl -n monitoring get secret grafana-admin >/dev/null 2>&1; then
  python3 - <<'PY' | kubectl apply -f -
import json,secrets
print(json.dumps({"apiVersion":"v1","kind":"Secret","metadata":{"name":"grafana-admin","namespace":"monitoring"},"type":"Opaque","stringData":{"admin-user":"admin","admin-password":secrets.token_urlsafe(32)}}))
PY
fi
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
helm repo update prometheus-community
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --version 92.7.0 --namespace monitoring -f monitoring/values.yaml --wait --timeout 8m
kubectl -n monitoring create configmap vigil-dashboard --from-file=monitoring/vigil-dashboard.json --dry-run=client -o yaml | kubectl apply -f -
kubectl -n monitoring label configmap vigil-dashboard grafana_dashboard=1 --overwrite
helm upgrade vigil ./helm/vigil -n vigil --reuse-values --set monitoring.enabled=true --atomic --wait --timeout 8m
echo 'Monitoring installed. Use private port-forwarding; see docs/OPERATIONS.md.'
