# Vigil infrastructure

`ec2/` provisions the public demonstration host: a VPC, one subnet, internet gateway, web-only firewall, SSM instance role, encrypted root volume, EC2 and a stable Elastic IP. The host runs K3s with Traefik, Metrics Server and local storage. Terraform has no database password or Kubernetes credentials. Deploy the application separately through Helm.

`eks/` is a source reference with two public subnets, a managed EKS control plane, a real managed node group, EBS CSI with Pod Identity and Metrics Server. It deliberately uses no NAT Gateway. It is locally validated but **not deployed or authorized under the current Free-plan policy**. Its `enable_paid_eks` variable defaults to false and cannot override the deployment helper's account-plan check.

See [deployment and costs](../docs/DEPLOYMENT.md) before provisioning and [operations](../docs/OPERATIONS.md) before deleting a host. Terraform state is ignored by Git. Keep state securely; it is required to manage and remove resources.

Each profile includes a reviewable configuration template: [EC2 variables](ec2/terraform.tfvars.example) and [EKS variables](eks/terraform.tfvars.example). Copy the EC2 file to `terraform.tfvars` to customize the public host locally. Both deployment gates remain `false` in the examples; leave EKS disabled. See the durable [project instructions](../AGENTS.md).

The deployment helper checks the actual AWS account plan before applying changes: only `FREE`/`ACTIVE` with positive credits passes. Paid accounts fail even with unused credits. Delete-only cleanup remains available. No workflow upgrades the account; the public demo must remain on its time-limited Free plan.

Both Terraform roots pass local validation; Helm and Kubernetes schema checks are recorded in [validation.txt](validation.txt). These results do not claim that EKS or the public AWS environment is running.

Offline validation, which creates no cloud resources:

```sh
terraform -chdir=infra/ec2 init -backend=false
terraform -chdir=infra/ec2 validate
terraform -chdir=infra/eks init -backend=false
terraform -chdir=infra/eks validate
terraform fmt -check -recursive infra
```
