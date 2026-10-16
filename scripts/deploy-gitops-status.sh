#!/usr/bin/env bash
set -euo pipefail
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
kubectl -n argocd get application vigil-preview -o json | python3 -c '
import json,sys
app=json.load(sys.stdin); status=app.get("status",{})
print(json.dumps({"application":app["metadata"]["name"],"sync":status.get("sync",{}),"health":status.get("health",{}),"operationPhase":status.get("operationState",{}).get("phase"),"conditions":status.get("conditions",[])},indent=2))'
kubectl -n vigil-preview get deployment,pods,service
