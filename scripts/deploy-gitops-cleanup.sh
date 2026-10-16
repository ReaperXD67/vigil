#!/usr/bin/env bash
# Removes only the named disposable review; never the production namespace.
set -euo pipefail
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
[[ ${VIGIL_TEMPORARY_REVIEW:-} == 1 ]] || { echo 'Set VIGIL_TEMPORARY_REVIEW=1 to remove the disposable review.' >&2; exit 2; }
for namespace in argocd vigil-preview; do
  actual=$(kubectl get namespace "$namespace" -o go-template='{{index .metadata.labels "app.kubernetes.io/part-of"}}')
  [[ $actual == vigil-gitops-review ]] || { echo "Refusing to delete unmarked namespace: $namespace" >&2; exit 1; }
done
kubectl -n argocd delete application vigil-preview --ignore-not-found --wait=true --timeout=180s
helm uninstall vigil-preview-data -n vigil-preview --wait --timeout 3m
kubectl delete namespace vigil-preview --wait=true --timeout=180s
helm uninstall argocd -n argocd --wait --timeout 3m
kubectl delete namespace argocd --wait=true --timeout=180s
# Helm retains CRDs. Only remove empty definitions owned by this exact release.
for name in applications.argoproj.io applicationsets.argoproj.io appprojects.argoproj.io; do
  kubectl get crd "$name" -o json | python3 -c 'import json,sys; c=json.load(sys.stdin); a=c["metadata"].get("annotations",{}); assert a.get("meta.helm.sh/release-name")=="argocd" and a.get("meta.helm.sh/release-namespace")=="argocd"'
  kubectl get "$name" -A -o json | python3 -c 'import json,sys; assert not json.load(sys.stdin)["items"], "CRD still has instances; refusing deletion"'
  kubectl delete crd "$name" --wait=true --timeout=60s
done
echo 'Disposable GitOps review removed. Verify production and return temporary capacity to its budget size.'
