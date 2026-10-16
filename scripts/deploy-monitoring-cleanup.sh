#!/usr/bin/env bash
# Removes only the explicitly marked temporary recording profile.
set -euo pipefail
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
cd "$(dirname "$0")/.."
[[ ${VIGIL_TEMPORARY_REVIEW:-} == 1 ]] || { echo 'Set VIGIL_TEMPORARY_REVIEW=1 for disposable review cleanup.' >&2; exit 2; }
[[ $(kubectl get namespace monitoring -o go-template='{{index .metadata.labels "app.kubernetes.io/part-of"}}') == vigil-monitoring-review ]] || { echo 'Refusing to delete an unmarked monitoring namespace.' >&2; exit 1; }
helm upgrade vigil ./helm/vigil -n vigil --reuse-values --set monitoring.enabled=false --atomic --wait --timeout 5m
helm uninstall monitoring -n monitoring --wait --timeout 3m
kubectl delete namespace monitoring --wait=true --timeout=180s
for resource in alertmanagerconfigs alertmanagers podmonitors probes prometheusagents prometheuses prometheusrules scrapeconfigs servicemonitors thanosrulers; do
  name="$resource.monitoring.coreos.com"
  [[ $(kubectl get crd "$name" -o go-template='{{index .metadata.labels "app.kubernetes.io/part-of"}}') == vigil-monitoring-review ]] || { echo "Refusing to delete an unmarked CRD: $name" >&2; exit 1; }
  kubectl get "$name" -A -o json | python3 -c 'import json,sys; assert not json.load(sys.stdin)["items"], "CRD still has instances; refusing deletion"'
  kubectl delete crd "$name" --wait=true --timeout=60s
done
echo 'Temporary monitoring and read-only anonymous access removed. Close tunnels and return host capacity to its budget size.'
