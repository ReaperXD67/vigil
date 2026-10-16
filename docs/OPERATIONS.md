# Operate Vigil

Run these commands from the host with `KUBECONFIG=/etc/rancher/k3s/k3s.yaml`, or from an authorized cluster workstation. SSM is the administrative path on the budget EC2 host.

## Health and release evidence

```sh
kubectl -n vigil get deployment,statefulset,pod,service,ingress,hpa,pvc
helm -n vigil list
kubectl -n vigil rollout status deployment/vigil-backend
kubectl -n vigil rollout status deployment/vigil-frontend
kubectl -n vigil get certificate
kubectl -n vigil logs deployment/vigil-backend --tail=50
kubectl -n vigil get events --sort-by=.lastTimestamp
curl --fail https://YOUR_HOST/health
curl --fail https://YOUR_HOST/ready
```

Liveness establishes process health. Readiness checks database connectivity. Neither proves user workflows: after a release, sign up, create/update/delete a task, record an incident, verify tenant isolation and sign out through the real public site. A green Terraform apply is only infrastructure evidence; a green Helm render is only manifest evidence.

The API HPA targets 75% of a 100m CPU request and is bounded to 2–4 replicas with a five-minute scale-down window. Metrics Server must be ready. Inspect `kubectl top pods -n vigil` and HPA conditions; configuration does not establish that an actual autoscaling event occurred. The single budget host cannot add nodes when capacity is exhausted.

## Database backup and recovery

```sh
bash scripts/backup-database.sh /var/backups/vigil
```

The script creates a PostgreSQL custom-format dump and checksum using restrictive permissions. A dump on the same EC2 root disk is **not** disaster recovery. Copy it to encrypted off-host storage, verify the checksum and test restoration. Backups contain private user data. The default deployment does not schedule backups or configure an external backup destination.

To test a dump without overwriting the live database:

```sh
kubectl -n vigil exec vigil-postgres-0 -- createdb -U vigil vigil_restore_test
kubectl -n vigil exec -i vigil-postgres-0 -- pg_restore -U vigil -d vigil_restore_test --no-owner < /secure/path/vigil.dump
kubectl -n vigil exec vigil-postgres-0 -- psql -U vigil -d vigil_restore_test -c '\dt'
kubectl -n vigil exec vigil-postgres-0 -- dropdb -U vigil vigil_restore_test
```

The last command deletes only the explicitly named disposable restore-test database. A production restore needs a maintenance window, current backup and a deliberate target decision. Never run `helm uninstall vigil-data`, remove its PVC or terminate EC2 as a routine application upgrade. K3s `local-path` data survives Pod restarts but does not survive destruction of its host disk. EKS EBS volumes retain data after PVC deletion and continue to cost money until removed.

## Roll back an application

```sh
helm -n vigil history vigil
helm -n vigil rollback vigil PREVIOUS_REVISION --wait --timeout 5m
```

Rollback restores application manifests/images, not database schema. The migration hook uses `pre-install,pre-upgrade`; a Helm rollback does not execute an automatic Alembic downgrade. Use backward-compatible expand/contract migrations, and assess database compatibility before rollback. If a migration fails, inspect its Job logs; do not delete the database to make a release pass.

## Monitoring verification and private access

After installing the optional profile, verify collection:

```sh
kubectl -n vigil get servicemonitor,prometheusrule
kubectl -n monitoring get pods
kubectl -n monitoring port-forward service/monitoring-prometheus 9090:9090
# In another shell:
curl --get --data-urlencode 'query=up{namespace="vigil",service="vigil-backend"}' http://127.0.0.1:9090/api/v1/query
```

Run several application operations and then inspect `vigil_http_requests_total`, `vigil_http_request_duration_seconds_bucket` and `vigil_checks_total`. Rates require at least two samples; an unused endpoint can legitimately show no rate. Grafana's **Vigil / operations** dashboard uses these exact metrics plus kube-state-metrics and cAdvisor data.

```sh
kubectl -n monitoring port-forward service/monitoring-grafana 3001:80
```

Access Grafana at `http://127.0.0.1:3001` from that workstation, or tunnel the loopback port through SSM. Retrieve `grafana-admin` from the cluster privately; do not paste credentials into issues or logs. Prometheus rules flag no API scrape target and sustained 5xx ratios. Notification delivery is not configured. Monitoring has short, ephemeral history to control memory/storage consumption.

For a credential-free screen recording, the opt-in `VIGIL_TEMPORARY_REVIEW=1 bash scripts/deploy-monitoring.sh` installs private anonymous **Viewer** access only. Its matching `deploy-monitoring-cleanup.sh` requires the review ownership labels, removes empty owned CRDs, and refuses to adopt an unowned existing monitoring installation. Keep all forwarding on loopback/SSM; no public admin or Grafana ingress is permitted.

For a bounded monitoring demonstration, first verify the Free plan and temporarily use an eligible host with sufficient memory. A resize plan must show an in-place change, with no replacement of the instance or disk; keep a database backup. After collecting evidence, remove the temporary stack before returning to the smaller host:

```sh
helm upgrade vigil ./helm/vigil -n vigil --reuse-values --set monitoring.enabled=false --atomic --wait --timeout 5m
helm uninstall monitoring -n monitoring --wait --timeout 3m
kubectl delete namespace monitoring --wait=true --timeout=120s
```

These commands remove the dedicated monitoring namespace, including its ephemeral history and dashboard/admin configuration. The source dashboard remains in Git and `deploy-monitoring.sh` recreates the stack. Close any SSM or kubectl forwarding sessions used for review. Wait until the app is healthy and HPA demand has returned to its normal two replicas, then review and apply the Terraform change back to `t3.small`. Metrics Server and the app's internal metrics remain available without the Prometheus/Grafana workload.

Helm deliberately retains Prometheus Operator CRDs after uninstall. On this dedicated demo cluster, the ten `monitoring.coreos.com` CRDs were removed after verifying their creation times/operator version matched the temporary installation and every resource type had zero instances across all namespaces. Do not remove shared CRDs merely because the monitoring namespace is gone: other releases may still depend on them. The monitoring installer can restore these definitions when explicitly enabled again.

## Isolated failure exercises

```sh
bash scripts/deploy-troubleshooting.sh
```

This creates a uniquely named `vigil-lab-*` namespace, demonstrates an invalid image and an empty Service selector, restores both, and deletes only that isolated namespace via its cleanup trap. It does not modify the live `vigil` namespace. The command captures events/readiness as evidence; it does not claim all possible failure modes were exercised.

## Capacity and security boundaries

The public deployment is one host and one database, so a host outage interrupts service. PostgreSQL credentials are existing Kubernetes Secrets; the K3s datastore uses secret encryption at rest and EC2 uses encrypted EBS. Keep the root kubeconfig private. Public metrics paths are blocked at nginx; collection uses the internal backend Service. Trusted proxy CIDRs are explicit.

Session state, authentication-attempt limits, demo-creation limits and per-service probe limits are shared in PostgreSQL. Migration `81c61159f5c4` adds the shared rate-window and capacity-lock tables before an application rollout. General read/write traffic limits remain per API process, so their aggregate maximum grows with replicas. One Traefik controller applies a public per-client request cap (180/minute plus burst 60) before the app, with local external-traffic routing to preserve source addresses. If Traefik is scaled, that limiter also becomes per controller. A production multi-node service should add a shared gateway for globally exact general traffic limits.

## Cost review and cleanup

Check AWS account plan/credits regularly using the command in [deployment](DEPLOYMENT.md). Stopping EC2 stops compute usage but EBS and Elastic IP continue to accrue usage. An Elastic IP was chosen so the hostname/certificate does not change on restart. Optional EKS has an ongoing control-plane cost even with zero workers.

Before cleanup, export the application workspace and make a verified off-host database backup. Then review a Terraform destroy plan from the **same root and state** that owns the environment:

```sh
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 plan -destroy -var=credit_plan_confirmed=true -out=cleanup.tfplan
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 show cleanup.tfplan
# Applying the reviewed cleanup plan terminates the host and deletes its root disk.
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 apply cleanup.tfplan
```

For EKS, remove Kubernetes-created load balancers before destroying the cluster, then inspect retained EBS volumes and snapshots. Destroying only Terraform-managed resources does not necessarily remove controller-created infrastructure. Confirm there are no project-tagged instances, addresses, load balancers or disks left, and retain a redacted cleanup log. No cleanup is performed automatically by the app.
