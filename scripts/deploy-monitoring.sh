#!/usr/bin/env bash
set -euo pipefail
umask 077
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
cd "$(dirname "$0")/.."
REVIEW_ARGS=()
if [[ ${VIGIL_TEMPORARY_REVIEW:-} == 1 ]]; then
  awk '/MemTotal/ {exit !($2 >= 3500000)}' /proc/meminfo || { echo 'The temporary review requires at least 4 GiB host capacity.' >&2; exit 2; }
  kubectl get namespace monitoring --ignore-not-found -o json | python3 -c 'import json,sys; raw=sys.stdin.read(); assert not raw.strip() or json.loads(raw).get("metadata",{}).get("labels",{}).get("app.kubernetes.io/part-of")=="vigil-monitoring-review", "Refusing to adopt an existing unowned monitoring namespace"'
  kubectl get crds -o json | python3 -c 'import json,sys; crds=[c for c in json.load(sys.stdin)["items"] if c["spec"]["group"]=="monitoring.coreos.com"]; assert all(c["metadata"].get("labels",{}).get("app.kubernetes.io/part-of")=="vigil-monitoring-review" for c in crds), "Refusing to adopt unowned monitoring CRDs for a disposable review"'
  REVIEW_ARGS=(-f monitoring/review-values.yaml)
fi
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
if [[ ${VIGIL_TEMPORARY_REVIEW:-} == 1 ]]; then
  kubectl label namespace monitoring app.kubernetes.io/part-of=vigil-monitoring-review --overwrite
fi
if ! kubectl -n monitoring get secret grafana-admin >/dev/null 2>&1; then
  python3 - <<'PY' | kubectl create -f -
import json,secrets
print(json.dumps({"apiVersion":"v1","kind":"Secret","metadata":{"name":"grafana-admin","namespace":"monitoring"},"type":"Opaque","stringData":{"admin-user":"admin","admin-password":secrets.token_urlsafe(32)}}))
PY
fi
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
helm repo update prometheus-community
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --version 92.7.0 --namespace monitoring -f monitoring/values.yaml "${REVIEW_ARGS[@]}" --wait --timeout 8m
if [[ ${VIGIL_TEMPORARY_REVIEW:-} == 1 ]]; then
  for resource in alertmanagerconfigs alertmanagers podmonitors probes prometheusagents prometheuses prometheusrules scrapeconfigs servicemonitors thanosrulers; do
    kubectl label crd "$resource.monitoring.coreos.com" app.kubernetes.io/part-of=vigil-monitoring-review --overwrite
  done
fi
kubectl -n monitoring create configmap vigil-dashboard --from-file=monitoring/vigil-dashboard.json --dry-run=client -o yaml | kubectl apply -f -
kubectl -n monitoring label configmap vigil-dashboard grafana_dashboard=1 --overwrite
helm upgrade vigil ./helm/vigil -n vigil --reuse-values --set monitoring.enabled=true --atomic --wait --timeout 8m
echo 'Monitoring installed. Use private port-forwarding; see docs/OPERATIONS.md.'
