# Deploy Vigil

Vigil has a budget AWS host profile and an optional EKS profile. Infrastructure source and local validation are not proof of a live deployment. The main [README](../README.md) records the currently verified public URL and delivery status. EKS is not claimed as live unless independent evidence is recorded there.

## Budget profile and credit boundary

The default is one EC2 `t3.small`, a 20 GiB encrypted gp3 root volume and one stable public IPv4 address in `ap-south-1`. K3s provides Kubernetes, Traefik ingress, Metrics Server and local PVCs. PostgreSQL and the app run on that same host. No NAT Gateway, load balancer, RDS or EKS control plane is created. Monitoring is optional; a 4 GiB `c7i-flex.large` has more memory headroom but consumes credits faster. Neither size is free indefinitely.

Before provisioning, verify the actual account plan, remaining credit, expiry, instance eligibility and current regional EC2 price. The new-account Free plan closes at six months or when credits run out; do not upgrade the account to bypass a rejected service. [AWS Free plan](https://docs.aws.amazon.com/en_en/awsaccountbilling/latest/aboutv2/free-tier-plans.html), [eligible EC2 instance types](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html).

```sh
aws login --profile scaler-lab --region ap-south-1
aws sts get-caller-identity --profile scaler-lab --region ap-south-1
aws freetier get-account-plan-state --profile scaler-lab --region us-east-1 \
  --query '{Plan:accountPlanType,Status:accountPlanStatus,Credits:accountPlanRemainingCredits,Expires:accountPlanExpirationDate}'
aws ec2 describe-instance-types --profile scaler-lab --region ap-south-1 \
  --filters Name=free-tier-eligible,Values=true --query 'InstanceTypes[].InstanceType'
```

The budget has three steady components: EC2 hours, gp3 GiB-months and public IPv4 hours. AWS lists IPv4 at $0.005/hour, approximately $3.65 for 730 hours, before applicable allowances. EC2 and EBS vary by region; data transfer, backups and logs can add usage. T3 CPU credits are set to `standard`, preventing unlimited-mode surplus CPU charges. [EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/), [EBS pricing](https://aws.amazon.com/ebs/pricing/), [IPv4 pricing](https://aws.amazon.com/vpc/pricing/).

Lightsail is a possible alternative: its official 2 GiB bundle is $12/month and 4 GiB is $24/month including IPv4/storage/transfer allowance. It is not provisioned by this repository; do not infer a running Lightsail instance from a browser tab. [Lightsail bundles](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html).

## Provision the host

Requirements: Terraform 1.11+, AWS CLI v2, Python 3, authenticated deployment permissions, and images already published by GitHub Actions. On Windows the AWS CLI may live at `%LOCALAPPDATA%/Programs/Amazon/AWSCLIV2/aws.exe`.

The helper privately passes temporary AWS browser-login credentials to Terraform's child environment; it never prints or stores them. From the repository root:

```sh
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 init
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 plan -var=credit_plan_confirmed=true -out=host.tfplan
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 show host.tfplan
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 apply host.tfplan
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 output
```

The plan gate records that the operator has checked credits; it is not an automatic billing cap. AWS Free plan enforcement is separate. Keep an ongoing credit check outside the application and remove unused resources deliberately.

Terraform launches an Amazon Linux 2023 host. User-data installs pinned K3s `v1.37.1+k3s1`, Helm `v3.22.0`, and clones the public repository to `/opt/vigil`. Ports 80/443 are public; SSH and Kubernetes port 6443 are closed. Administration uses SSM. Confirm `/var/log/vigil-bootstrap.log` ends with `VIGIL_BOOTSTRAP_COMPLETE` before deploying. The root volume stores PostgreSQL and is deleted when the EC2 instance is terminated; make an off-host backup first.

## Deploy the application and HTTPS

Connect using the `admin_command` Terraform output, then run:

```sh
sudo -i
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
cloud-init status --wait
tail -n 30 /var/log/vigil-bootstrap.log
cd /opt/vigil
git fetch origin main
git checkout <published-40-character-commit-sha>
bash scripts/deploy.sh <published-40-character-commit-sha> <public-hostname> <your-acme-email>
```

Use a domain you control with an A record pointing at the Elastic IP, or the `suggested_hostname` output under `sslip.io`. Third-party wildcard DNS and Let's Encrypt rate limits can affect that convenience hostname; a custom domain is more dependable. No domain purchase is required by these scripts.

The third script argument is an optional ACME contact email. Omit it if no contact is available; certificate expiry must then be monitored through cluster status rather than contact notifications.

`deploy.sh` generates a random database password once into two existing Kubernetes Secrets; no values are printed. It waits for the separate database release, installs cert-manager `v1.21.2`, configures a Let's Encrypt HTTP-01 issuer, then installs the application with an Alembic migration gate. HTTPS certificate readiness plus public `/health` and `/ready` checks must pass before the script reports success. An Ingress-specific HTTPS redirect leaves cert-manager's separate HTTP challenge route available.

Runtime environment uses `APP_ENV=production`, `ALLOWED_ORIGINS=https://<host>` and a secret `DATABASE_URL`. API replicas have background checks disabled to prevent duplicate scheduling. A separate single-replica worker enables checks for due non-demo services and uses a Recreate update strategy so two schedulers do not overlap during normal upgrades. Its Service is internal for metrics only. Cookie sessions are stored in PostgreSQL. Uvicorn trusts forwarded headers only from loopback and the explicit K3s/EKS private CIDRs; update `env.FORWARDED_ALLOW_IPS` if the cluster network changes.

## Optional observability

On a host with enough free memory:

```sh
bash scripts/deploy-monitoring.sh
```

This installs pinned `kube-prometheus-stack` chart `92.7.0`, a ServiceMonitor, alert rules, and a Grafana dashboard with real API availability, request/error rates, p95 latency, checks, replica and memory queries. Prometheus retains six hours, up to 500 MB, on ephemeral storage. Grafana dashboard configuration is source-controlled; interactive dashboard edits and metrics history do not survive replacement. Grafana/Prometheus have no public ingress. Alert rules are evaluated, but no email/Slack receiver is configured. Private access and verification are in [operations](OPERATIONS.md).

## Optional EKS: explicit cost opt-in

`infra/eks` is a separate implementation, never applied by the budget deployment. Standard EKS control-plane pricing is $0.10/hour (about $73 per 730-hour month), **before** EC2 nodes, EBS, IPv4, logs and ingress load-balancer costs. Its two public subnets avoid NAT charges; that tradeoff should be reconsidered for a production security architecture. [EKS pricing](https://aws.amazon.com/eks/pricing/).

It creates a managed EKS cluster at Kubernetes `1.35`, a real 1–2-node managed group, encrypted node disks, SSM node access, audit logs, VPC CNI, CoreDNS, kube-proxy, Metrics Server, Pod Identity and EBS CSI. Add-on versions are resolved from AWS compatibility data for the selected Kubernetes version and recorded in Terraform state/output; review the plan on upgrades. The Kubernetes public API is restricted to the supplied operator `/32`; node traffic uses its private endpoint.

```sh
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/eks init
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/eks plan -var=enable_paid_eks=true -var=admin_cidr=YOUR_IPV4/32 -out=eks.tfplan
# Apply only after a deliberate cost review; this is not part of the public demo.
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/eks apply eks.tfplan
aws eks update-kubeconfig --region ap-south-1 --name vigil-eks
kubectl apply -f infra/eks/storage-class.yaml
helm repo add traefik https://traefik.github.io/charts
helm repo update traefik
helm upgrade --install traefik traefik/traefik --version 41.7.1 --namespace traefik --create-namespace --set deployment.replicas=1 --wait
kubectl -n traefik get service traefik
```

Point your domain at Traefik's load balancer, then run `STORAGE_CLASS=vigil-gp3 bash scripts/deploy.sh ...` with an EKS kubeconfig in `KUBECONFIG`. The EBS StorageClass uses `Retain`: after deleting a PVC, its volume needs deliberate cleanup. EBS is zonal; this single PostgreSQL instance is not automatically multi-AZ highly available. Ingress, TLS and monitoring use the same app charts. A source implementation is not a claim that these EKS resources were deployed or load-tested.

Release versions were checked against official upstream repositories on October 15, 2026: [K3s releases](https://github.com/k3s-io/k3s/releases), [Helm releases](https://github.com/helm/helm/releases), [cert-manager releases](https://github.com/cert-manager/cert-manager/releases), [monitoring chart](https://github.com/prometheus-community/helm-charts/tree/kube-prometheus-stack-92.7.0/charts/kube-prometheus-stack), [Traefik chart](https://github.com/traefik/traefik-helm-chart/releases).
