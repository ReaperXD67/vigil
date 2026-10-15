#!/usr/bin/env bash
# Failures are confined to a uniquely named namespace, never the live app.
set -euo pipefail
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
LAB_NAMESPACE="vigil-lab-$(date +%s)-$RANDOM"
cleanup() {
  if [[ "$LAB_NAMESPACE" =~ ^vigil-lab-[0-9]+-[0-9]+$ ]]; then
    kubectl delete namespace "$LAB_NAMESPACE" --wait=false --ignore-not-found
  fi
}
trap cleanup EXIT INT TERM
kubectl create namespace "$LAB_NAMESPACE"
kubectl -n "$LAB_NAMESPACE" create deployment web --image=nginx:1.29.2-alpine
kubectl -n "$LAB_NAMESPACE" rollout status deployment/web --timeout=180s
kubectl -n "$LAB_NAMESPACE" expose deployment web --port=80
echo 'Failure 1: image tag does not exist.'
kubectl -n "$LAB_NAMESPACE" set image deployment/web nginx=nginx:vigil-intentionally-missing
sleep 8
kubectl -n "$LAB_NAMESPACE" get pods
kubectl -n "$LAB_NAMESPACE" get events --sort-by=.lastTimestamp
echo 'Restore image and verify readiness.'
kubectl -n "$LAB_NAMESPACE" set image deployment/web nginx=nginx:1.29.2-alpine
kubectl -n "$LAB_NAMESPACE" rollout status deployment/web --timeout=180s
echo 'Failure 2: Service selector matches no Pods.'
kubectl -n "$LAB_NAMESPACE" patch service web --type merge -p '{"spec":{"selector":{"app":"intentionally-wrong"}}}'
kubectl -n "$LAB_NAMESPACE" get endpointslice -l kubernetes.io/service-name=web
kubectl -n "$LAB_NAMESPACE" patch service web --type merge -p '{"spec":{"selector":{"app":"web"}}}'
kubectl -n "$LAB_NAMESPACE" get endpointslice -l kubernetes.io/service-name=web
echo 'Both exercises restored; isolated namespace is now cleaned up.'
