terraform {
  required_version = ">= 1.11, < 2.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.100.0" }
  }
}
provider "aws" {
  region = var.region
  default_tags { tags = { Project = "vigil", ManagedBy = "terraform", Profile = "optional-eks" } }
}
variable "region" { default = "ap-south-1" }
variable "enable_paid_eks" {
  type        = bool
  default     = false
  description = "Explicitly unlock paid EKS infrastructure. Never enabled for the budget demo."
  validation {
    condition     = var.enable_paid_eks
    error_message = "EKS is deliberately disabled. Review its cost and explicitly set enable_paid_eks=true."
  }
}
variable "admin_cidr" {
  description = "Your current public IPv4 /32 allowed to use the Kubernetes API."
  type        = string
  default     = "203.0.113.10/32"
  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && endswith(var.admin_cidr, "/32")
    error_message = "Provide exactly one IPv4 /32, never 0.0.0.0/0."
  }
}
variable "kubernetes_version" { default = "1.35" }
variable "node_instance_type" { default = "t3.small" }
variable "desired_nodes" {
  type    = number
  default = 2
  validation {
    condition     = var.desired_nodes >= 1 && var.desired_nodes <= 2
    error_message = "This demonstration allows one or two nodes."
  }
}
data "aws_availability_zones" "available" { state = "available" }
data "aws_caller_identity" "current" {}
locals { cluster_name = "vigil-eks" }
resource "aws_vpc" "this" {
  cidr_block           = "10.68.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(aws_vpc.this.cidr_block, 8, count.index + 1)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { "kubernetes.io/role/elb" = "1", "kubernetes.io/cluster/${local.cluster_name}" = "shared" }
}
resource "aws_internet_gateway" "this" { vpc_id = aws_vpc.this.id }
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
}
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
resource "aws_iam_role" "cluster" {
  name               = "vigil-eks-control-plane"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "eks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "cluster" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}
resource "aws_eks_cluster" "this" {
  name     = local.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version
  access_config {
    authentication_mode                         = "API"
    bootstrap_cluster_creator_admin_permissions = true
  }
  vpc_config {
    subnet_ids              = aws_subnet.public[*].id
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = [var.admin_cidr]
  }
  enabled_cluster_log_types = ["api", "audit", "authenticator"]
  depends_on                = [aws_iam_role_policy_attachment.cluster, aws_cloudwatch_log_group.cluster]
}
resource "aws_cloudwatch_log_group" "cluster" {
  name              = "/aws/eks/${local.cluster_name}/cluster"
  retention_in_days = 7
}
resource "aws_iam_role" "nodes" {
  name               = "vigil-eks-nodes"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "nodes" {
  for_each   = toset(["AmazonEKSWorkerNodePolicy", "AmazonEC2ContainerRegistryReadOnly", "AmazonEKS_CNI_Policy", "AmazonSSMManagedInstanceCore"])
  role       = aws_iam_role.nodes.name
  policy_arn = "arn:aws:iam::aws:policy/${each.value}"
}
resource "aws_launch_template" "nodes" {
  name_prefix = "vigil-eks-"
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type           = "gp3"
      volume_size           = 20
      encrypted             = true
      delete_on_termination = true
    }
  }
}
resource "aws_eks_node_group" "this" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "vigil-general"
  node_role_arn   = aws_iam_role.nodes.arn
  subnet_ids      = aws_subnet.public[*].id
  instance_types  = [var.node_instance_type]
  ami_type        = "AL2023_x86_64_STANDARD"
  capacity_type   = "ON_DEMAND"
  launch_template {
    id      = aws_launch_template.nodes.id
    version = aws_launch_template.nodes.latest_version
  }
  scaling_config {
    desired_size = var.desired_nodes
    min_size     = 1
    max_size     = 2
  }
  update_config { max_unavailable = 1 }
  depends_on = [aws_iam_role_policy_attachment.nodes, aws_route_table_association.public]
}
data "aws_eks_addon_version" "addons" {
  for_each           = toset(["vpc-cni", "coredns", "kube-proxy", "eks-pod-identity-agent", "aws-ebs-csi-driver", "metrics-server"])
  addon_name         = each.value
  kubernetes_version = var.kubernetes_version
  most_recent        = true
}
resource "aws_iam_role" "ebs" {
  name               = "vigil-eks-ebs-csi"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "pods.eks.amazonaws.com" }, Action = ["sts:AssumeRole", "sts:TagSession"] }] })
}
resource "aws_iam_role_policy_attachment" "ebs" {
  role       = aws_iam_role.ebs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}
resource "aws_eks_pod_identity_association" "ebs" {
  cluster_name    = aws_eks_cluster.this.name
  namespace       = "kube-system"
  service_account = "ebs-csi-controller-sa"
  role_arn        = aws_iam_role.ebs.arn
}
resource "aws_eks_addon" "addons" {
  for_each                    = data.aws_eks_addon_version.addons
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = each.key
  addon_version               = each.value.version
  configuration_values        = each.key == "vpc-cni" ? jsonencode({ enableNetworkPolicy = "true" }) : null
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"
  depends_on                  = [aws_eks_node_group.this, aws_iam_role_policy_attachment.ebs, aws_eks_pod_identity_association.ebs]
}
output "configure_kubectl" { value = "aws eks update-kubeconfig --region ${var.region} --name ${aws_eks_cluster.this.name}" }
output "addon_versions" { value = { for name, addon in aws_eks_addon.addons : name => addon.addon_version } }
