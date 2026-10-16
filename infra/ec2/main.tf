terraform {
  required_version = ">= 1.11, < 2.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.100.0" }
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = "vigil", ManagedBy = "terraform", Profile = "budget-demo" } }
}

variable "region" { default = "ap-south-1" }
variable "instance_type" {
  default = "t3.small"
  validation {
    condition     = contains(["t3.small", "c7i-flex.large"], var.instance_type)
    error_message = "Use t3.small (budget) or c7i-flex.large (more monitoring headroom); verify account eligibility first."
  }
}
variable "credit_plan_confirmed" {
  description = "Set true only after checking account-plan state, expiry and remaining credits."
  type        = bool
  default     = false
}
variable "root_volume_size" {
  type    = number
  default = 20
  validation {
    condition     = var.root_volume_size >= 20 && var.root_volume_size <= 30
    error_message = "Keep this budget deployment between 20 and 30 GiB."
  }
}

data "aws_availability_zones" "available" { state = "available" }
data "aws_ssm_parameter" "ami" { name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" }

resource "aws_vpc" "this" {
  cidr_block           = "10.67.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "vigil" }
}
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = "10.67.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = false
}
resource "aws_subnet" "public_secondary" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = "10.67.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = false
  tags                    = { Name = "vigil-public-secondary" }
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
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
resource "aws_route_table_association" "public_secondary" {
  subnet_id      = aws_subnet.public_secondary.id
  route_table_id = aws_route_table.public.id
}
resource "aws_security_group" "web" {
  name        = "vigil-web"
  description = "Public HTTPS/HTTP only; administration uses Systems Manager"
  vpc_id      = aws_vpc.this.id
}
resource "aws_vpc_security_group_ingress_rule" "web" {
  for_each          = toset(["80", "443"])
  security_group_id = aws_security_group.web.id
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  cidr_ipv4         = "0.0.0.0/0"
}
resource "aws_vpc_security_group_egress_rule" "out" {
  security_group_id = aws_security_group.web.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}
resource "aws_iam_role" "host" {
  name               = "vigil-host"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_instance_profile" "host" {
  name = "vigil-host"
  role = aws_iam_role.host.name
}
resource "aws_instance" "host" {
  ami                         = data.aws_ssm_parameter.ami.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.web.id]
  iam_instance_profile        = aws_iam_instance_profile.host.name
  user_data                   = replace(file("${path.module}/../../scripts/bootstrap-host.sh"), "\r\n", "\n")
  user_data_replace_on_change = false
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }
  dynamic "credit_specification" {
    for_each = startswith(var.instance_type, "t3.") ? [1] : []
    content { cpu_credits = "standard" }
  }
  tags = { Name = "vigil-public-demo" }
  lifecycle {
    precondition {
      condition     = var.credit_plan_confirmed
      error_message = "Deployment is locked. Verify AWS Free plan credits/expiry and set credit_plan_confirmed=true."
    }
    ignore_changes = [ami, user_data]
  }
  depends_on = [aws_route_table_association.public, aws_iam_role_policy_attachment.ssm]
}
resource "aws_eip" "web" {
  domain   = "vpc"
  instance = aws_instance.host.id
  tags     = { Name = "vigil-web" }
}
output "instance_id" { value = aws_instance.host.id }
output "public_ip" { value = aws_eip.web.public_ip }
output "suggested_hostname" { value = "vigil.${replace(aws_eip.web.public_ip, ".", "-")}.sslip.io" }
output "admin_command" { value = "aws ssm start-session --region ${var.region} --target ${aws_instance.host.id}" }
