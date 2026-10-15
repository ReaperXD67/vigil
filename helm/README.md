# Vigil Helm charts

Install `vigil-data` first and wait for PostgreSQL. Install `vigil` second using a published full-commit image tag. Its pre-install/pre-upgrade Job runs Alembic before any application rollout; a migration failure blocks the release. PostgreSQL credentials live in existing Kubernetes Secrets, never chart values.

The application has two frontend replicas and an API HPA bounded to 2–4 replicas. API readiness checks database access; liveness checks the process. One PostgreSQL StatefulSet persists data in an 8 GiB PVC. This is a single-database demonstration, not database high availability. Storage and backup limitations are described in [operations](../docs/OPERATIONS.md).

Frontend updates use `Recreate` with a brief cutover: every ready frontend serves the same index and hashed assets. API updates use zero surge and one unavailable replica to stay within the small host's memory budget while retaining one serving replica at the default minimum of two. Successful migration Jobs are removed immediately by the Helm hook policy; failed Jobs retain diagnostic evidence for up to one day.

```sh
helm lint helm/vigil --set backend.tag=validation --set frontend.tag=validation
helm lint helm/vigil-data
helm template vigil helm/vigil --set backend.tag=validation --set frontend.tag=validation
```

Use [scripts/deploy.sh](../scripts/deploy.sh) for the complete release sequence, TLS and readiness checks. [Deployment guide](../docs/DEPLOYMENT.md).
