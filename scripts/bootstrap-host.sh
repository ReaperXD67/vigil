#!/usr/bin/env bash
# Cloud-init bootstrap only. No app/database credentials belong in user-data.
set -euo pipefail
exec > >(tee -a /var/log/vigil-bootstrap.log) 2>&1
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
K3S_VERSION='v1.37.1+k3s1'
HELM_VERSION='v3.22.0'
dnf install -y git curl-minimal jq tar gzip openssl python3
mkdir -p /var/lib/rancher/k3s/server/manifests
cat > /var/lib/rancher/k3s/server/manifests/traefik-config.yaml <<'YAML'
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    deployment:
      replicas: 1
    service:
      spec:
        externalTrafficPolicy: Local
YAML
curl --fail --silent --show-error --location "https://raw.githubusercontent.com/k3s-io/k3s/${K3S_VERSION}/install.sh" -o /tmp/install-k3s.sh
INSTALL_K3S_VERSION="$K3S_VERSION" INSTALL_K3S_SKIP_SELINUX_RPM=true INSTALL_K3S_EXEC='server --write-kubeconfig-mode 600 --cluster-cidr 10.52.0.0/16 --service-cidr 10.53.0.0/16 --cluster-dns 10.53.0.10 --secrets-encryption' sh /tmp/install-k3s.sh
curl --fail --silent --show-error --location "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" -o /tmp/helm.tar.gz
curl --fail --silent --show-error --location "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz.sha256sum" -o /tmp/helm.sha256
EXPECTED_HELM_SHA=$(awk '{print $1}' /tmp/helm.sha256)
printf '%s  /tmp/helm.tar.gz\n' "$EXPECTED_HELM_SHA" | sha256sum --check
tar -xzf /tmp/helm.tar.gz -C /tmp
install -m 755 /tmp/linux-amd64/helm /usr/local/bin/helm
kubectl wait --for=condition=Ready node --all --timeout=180s
kubectl -n kube-system rollout status deployment/traefik --timeout=180s
git clone https://github.com/ReaperXD67/vigil.git /opt/vigil
chmod 700 /root
echo VIGIL_BOOTSTRAP_COMPLETE
