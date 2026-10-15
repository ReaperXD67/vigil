# Vigil infrastructure

`ec2/` provisions the public demonstration host: a VPC, one subnet, internet gateway, web-only firewall, SSM instance role, encrypted root volume, EC2 and a stable Elastic IP. The host runs K3s with Traefik, Metrics Server and local storage. Terraform has no database password or Kubernetes credentials. Deploy the application separately through Helm.

`eks/` is an optional, separately billed implementation with two public subnets, a managed EKS control plane, a real managed node group, EBS CSI with Pod Identity and Metrics Server. It deliberately uses no NAT Gateway. It is locked unless `enable_paid_eks=true`; it is **not** the default public deployment.

See [deployment and costs](../docs/DEPLOYMENT.md) before provisioning and [operations](../docs/OPERATIONS.md) before deleting a host. Terraform state is ignored by Git. Keep state securely; it is required to manage and remove resources.

Each profile includes a reviewable configuration template: [EC2 variables](ec2/terraform.tfvars.example) and [EKS variables](eks/terraform.tfvars.example). Copy the applicable file to `terraform.tfvars` to customize it locally. Both deployment gates remain `false` in the examples; the EC2 credit acknowledgement and separate EKS cost opt-in must be deliberate.

Both Terraform roots pass local validation; Helm and Kubernetes schema checks are recorded in [validation.txt](validation.txt). These results do not claim that EKS or the public AWS environment is running.

Offline validation, which creates no cloud resources:

```sh
terraform -chdir=infra/ec2 init -backend=false
terraform -chdir=infra/ec2 validate
terraform -chdir=infra/eks init -backend=false
terraform -chdir=infra/eks validate
terraform fmt -check -recursive infra
```
