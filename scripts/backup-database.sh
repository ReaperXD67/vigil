#!/usr/bin/env bash
set -euo pipefail
umask 077
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
BACKUP_DIR=${1:-/var/backups/vigil}
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/vigil-$(date -u +%Y%m%dT%H%M%SZ).dump"
kubectl -n vigil exec vigil-postgres-0 -- pg_dump -U vigil -d vigil --format=custom > "$BACKUP_PATH.partial"
test -s "$BACKUP_PATH.partial"
mv "$BACKUP_PATH.partial" "$BACKUP_PATH"
sha256sum "$BACKUP_PATH" > "$BACKUP_PATH.sha256"
echo "Backup created: $BACKUP_PATH"
echo 'Copy this dump and checksum to an encrypted location outside this instance.'
