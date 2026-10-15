# Vigil monitoring

The optional [values](values.yaml) pin the deployment workflow to `kube-prometheus-stack` 92.7.0 with small resource requests, private services and six-hour/500 MB ephemeral Prometheus retention. The [dashboard](vigil-dashboard.json) reads real counters and a latency histogram exported by the API/worker, plus Kubernetes replica and memory metrics. It is not populated with sample dashboard telemetry.

Run `bash scripts/deploy-monitoring.sh` from the repository root on an already deployed cluster with sufficient memory. The script generates a Grafana administrator secret, installs the stack, imports the dashboard and enables the app's ServiceMonitor/rules. No notification receiver is configured. [Operations and verification](../docs/OPERATIONS.md#monitoring-verification-and-private-access), [local validation evidence](../infra/validation.txt).

Live collection and the eight-panel Grafana dashboard were verified on October 15, 2026 using temporary 4 GiB capacity. The stack was then removed to preserve the public demo's credits and memory; continuous Prometheus/Grafana operation is not claimed. The app still exports internal metrics and Kubernetes Metrics Server supports its HPA.

Interactive dashboard verification exposed Grafana exceeding its original 256 MiB limit; the source now allows 512 MiB and recommends at least 4 GiB host memory. The captured dashboard screenshot predates two display corrections: the error ratio is bounded to 0–1 (0–100%), and the checks-per-minute panel uses a numeric unit instead of an operations-per-second suffix. Those source corrections have not been used to reinterpret the captured measurements.
