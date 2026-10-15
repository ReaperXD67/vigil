# Vigil monitoring

The optional [values](values.yaml) pin the deployment workflow to `kube-prometheus-stack` 92.7.0 with small resource requests, private services and six-hour/500 MB ephemeral Prometheus retention. The [dashboard](vigil-dashboard.json) reads real counters and a latency histogram exported by the API/worker, plus Kubernetes replica and memory metrics. It is not populated with sample dashboard telemetry.

Run `bash scripts/deploy-monitoring.sh` from the repository root on an already deployed cluster with sufficient memory. The script generates a Grafana administrator secret, installs the stack, imports the dashboard and enables the app's ServiceMonitor/rules. No notification receiver is configured. [Operations and verification](../docs/OPERATIONS.md#monitoring-verification-and-private-access), [local validation evidence](../infra/validation.txt).
