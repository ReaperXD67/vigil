# Deploy Vigil

Vigil has a budget AWS host profile and an optional EKS profile. Infrastructure source and local validation are not proof of a live deployment. The main [README](../README.md) records the currently verified public URL and delivery status. EKS is not claimed as live unless independent evidence is recorded there.

## Budget profile and credit boundary

The default is one EC2 `t3.small`, a 20 GiB encrypted gp3 root volume and one stable public IPv4 address in `ap-south-1`. The VPC defines two public subnets in separate availability zones; only the first hosts compute. The second adds no EC2, NAT Gateway, or public IPv4 allocation. K3s provides Kubernetes, Traefik ingress, Metrics Server and local PVCs. PostgreSQL and the app run on that same host. No NAT Gateway, load balancer, RDS or EKS control plane is created. Monitoring is optional; a 4 GiB `c7i-flex.large` has more memory headroom but consumes credits faster. Neither size is free indefinitely.

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

The October 15, 2026 deployment preflight verified an active Free plan with enough remaining credit for this host. AWS's Price List API returned Mumbai Linux `t3.small` at $0.0224/hour and gp3 at $0.0912/GiB-month. At 730 hours, the selected host is approximately **$21.83/month** ($16.35 compute + $1.82 for 20 GiB + $3.65 IPv4), before variable transfer or backup usage. Credits offset eligible usage; this estimate is not a perpetual free-hosting promise. Recheck the account and prices before creating another environment.

Lightsail is a possible alternative: its official 2 GiB bundle is $12/month and 4 GiB is $24/month including IPv4/storage/transfer allowance. It is not provisioned by this repository; do not infer a running Lightsail instance from a browser tab. [Lightsail bundles](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html).

## Provision the host

Requirements: Terraform 1.11+, AWS CLI v2, Python 3, authenticated deployment permissions, and images already published by GitHub Actions. On Windows the AWS CLI may live at `%LOCALAPPDATA%/Programs/Amazon/AWSCLIV2/aws.exe`.

The helper privately passes temporary AWS browser-login credentials to Terraform's child environment; it never prints or stores them. Before a Terraform apply, it independently requires AWS to report `FREE`, `ACTIVE`, and a positive USD credit balance. Paid accounts are rejected even when they have credits. Delete-only saved plans and explicit destroy commands remain available for cleanup. The helper never upgrades the account. From the repository root:

```sh
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 init
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 plan -var=credit_plan_confirmed=true -out=host.tfplan
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 show host.tfplan
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 apply host.tfplan
python scripts/deploy-terraform.py --profile scaler-lab -- -chdir=infra/ec2 output
```

In PowerShell, quote arguments containing filenames, such as `'-out=host.tfplan'`, so the shell does not split the extension into a separate argument.

The Terraform variable records that the operator reviewed estimated usage; the helper checks the actual account plan. AWS's Free plan provides the no-charge protection and suspends/closes access when its credit or time limit ends. Never upgrade the account, join an AWS Organization, or enable services/enrollments that AWS documents as automatically changing the plan. A different operator can bypass a local script, so preserve that account boundary. This is time-limited hosting, not a guarantee of perpetual availability.

Terraform launches an Amazon Linux 2023 host. User-data installs pinned K3s `v1.37.1+k3s1`, Helm `v3.22.0`, and clones the public repository to `/opt/vigil`. Ports 80/443 are public; SSH and Kubernetes port 6443 are closed. Administration uses SSM. Confirm `/var/log/vigil-bootstrap.log` ends with `VIGIL_BOOTSTRAP_COMPLETE` before deploying. The root volume stores PostgreSQL and is deleted when the EC2 instance is terminated; make an off-host backup first.

## Deploy the application and HTTPS

Before each remote deployment, run this local check. It refuses an expired, paid, unknown, or empty-credit plan:

```sh
python scripts/deploy-terraform.py --profile scaler-lab --check-free-plan
```

Once that check succeeds, connect using the `admin_command` Terraform output and run:

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

Application upgrades retain explicitly configured Helm values, including an enabled monitoring profile, while applying new chart defaults. The migration Job receives the same production environment/origin configuration as the API. Secret creation avoids the client-side apply annotation, so credentials are not duplicated into annotation text.

Runtime environment uses `APP_ENV=production`, `ALLOWED_ORIGINS=https://<host>` and a secret `DATABASE_URL`. API replicas have background checks disabled to prevent duplicate scheduling. A separate single-replica worker enables checks for due non-demo services and uses a Recreate update strategy so two schedulers do not overlap during normal upgrades. Its Service is internal for metrics only. Cookie sessions are stored in PostgreSQL. Uvicorn trusts forwarded headers only from loopback and the explicit K3s/EKS private CIDRs; update `env.FORWARDED_ALLOW_IPS` if the cluster network changes.

## Optional GitOps review

The [isolated Argo CD workflow](../gitops/README.md) demonstrates a Git-driven promotion using this same app chart, a separate preview database and namespace-scoped permissions. It never adopts the public Helm release. The controller and preview are temporary and private; record actual Synced/Healthy evidence, then clean them up before the monitoring demonstration and return to the budget host.

## Optional observability

On a host with enough free memory:

```sh
bash scripts/deploy-monitoring.sh
```

This installs pinned `kube-prometheus-stack` chart `92.7.0`, a ServiceMonitor, alert rules, and a Grafana dashboard with real API availability, request/error rates, p95 latency, checks, replica and memory queries. Prometheus retains six hours, up to 500 MB, on ephemeral storage. Grafana dashboard configuration is source-controlled; interactive dashboard edits and metrics history do not survive replacement. Grafana/Prometheus have no public ingress. Alert rules are evaluated, but no email/Slack receiver is configured. Private access and verification are in [operations](OPERATIONS.md).

## EKS reference: source only under the Free-plan policy

`infra/eks` is a separate, locally validated reference implementation. It is not deployed, and this project's current policy prohibits deploying it or changing the AWS account plan. The deployment helper deliberately rejects every paid account, even if credits remain. The `enable_paid_eks` Terraform gate defaults to false; changing that variable does not override the helper or authorize an account upgrade.

Standard EKS control-plane pricing is $0.10/hour (about $73 per 730-hour month), before EC2 nodes, EBS, IPv4, logs and ingress load-balancer costs. The reference uses two public subnets to avoid NAT charges; this is a cost/security tradeoff, not a production-network recommendation. [EKS pricing](https://aws.amazon.com/eks/pricing/).

The code describes a managed Kubernetes `1.35` cluster, a real 1–2-node managed group, encrypted node disks, SSM node access, audit logs, VPC CNI, CoreDNS, kube-proxy, Metrics Server, Pod Identity and EBS CSI. Add-on versions resolve from AWS compatibility data for the selected Kubernetes version. Public API access is restricted to an operator `/32`; node traffic uses the private endpoint. The supplied EBS StorageClass uses `Retain`, so retained volumes would require deliberate cleanup. A single PostgreSQL instance would not be automatically multi-AZ highly available.

Safe local validation does not create cloud resources:

```sh
terraform -chdir=infra/eks init -backend=false
terraform -chdir=infra/eks validate
terraform -chdir=infra/eks fmt -check
```

Any future EKS deployment would require a separately authorized policy change, a reviewed hosting budget and a new deployment workflow. No runnable paid-account apply sequence is provided here. The current Free-plan guard must remain in place. This source implementation is not evidence of live EKS, EKS load testing, or multi-node availability.

Release versions were checked against official upstream repositories on October 15, 2026: [K3s releases](https://github.com/k3s-io/k3s/releases), [Helm releases](https://github.com/helm/helm/releases), [cert-manager releases](https://github.com/cert-manager/cert-manager/releases), [monitoring chart](https://github.com/prometheus-community/helm-charts/tree/kube-prometheus-stack-92.7.0/charts/kube-prometheus-stack), [Traefik chart](https://github.com/traefik/traefik-helm-chart/releases).
