# AWS Deployment Guide

Deploy Colloquium to Amazon Web Services using ECS Fargate and RDS.

## Prerequisites

1. **AWS Account** with admin permissions
2. **AWS CLI** installed and configured
3. **Terraform** >= 1.0 installed

### Install Prerequisites

```bash
# Install AWS CLI (macOS)
brew install awscli

# Install AWS CLI (Linux)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region

# Install Terraform (macOS)
brew install terraform

# Install Terraform (Linux)
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

## Quick Start

```bash
# Create a new journal instance for AWS
npx create-colloquium-journal init "My Journal" \
  --deployment aws \
  --region us-east-1 \
  --admin-email admin@example.com

# Navigate to the instance directory
cd my-journal-instance

# Deploy (takes ~15-20 minutes)
./deploy.sh
```

## Architecture

The AWS deployment creates the following infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                           AWS Cloud                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                         VPC                                 │  │
│  │  ┌─────────────────────┐    ┌─────────────────────────┐   │  │
│  │  │   Public Subnets    │    │    Private Subnets       │   │  │
│  │  │                     │    │                          │   │  │
│  │  │  ┌──────────────┐  │    │  ┌─────────────────────┐│   │  │
│  │  │  │     ALB      │  │    │  │   ECS Fargate       ││   │  │
│  │  │  │  (HTTPS/80)  │──┼────┼──│  ┌───────┐ ┌─────┐ ││   │  │
│  │  │  └──────────────┘  │    │  │  │  Web  │ │ API │ ││   │  │
│  │  │                     │    │  │  └───────┘ └─────┘ ││   │  │
│  │  │  ┌──────────────┐  │    │  └─────────────────────┘│   │  │
│  │  │  │ NAT Gateway  │──┼────┼──────────┐              │   │  │
│  │  │  └──────────────┘  │    │          ▼              │   │  │
│  │  └─────────────────────┘    │  ┌─────────────────┐   │   │  │
│  │                             │  │   RDS Postgres   │   │   │  │
│  │                             │  │  (+ job queue)   │   │   │  │
│  │                             │  └─────────────────┘   │   │  │
│  │                             └─────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  S3 Uploads   │  │  S3 Published │  │  Secrets Manager    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Resources Created

| Resource | AWS Service | Purpose |
|----------|-------------|---------|
| VPC | Amazon VPC | Network isolation with public/private subnets |
| Internet Gateway | VPC | Internet access for public subnets |
| NAT Gateway | VPC | Internet access for private subnets |
| ALB | Elastic Load Balancing | HTTP/HTTPS traffic distribution |
| ECS Cluster | Elastic Container Service | Container orchestration |
| Fargate Tasks | ECS Fargate | Serverless containers (web + API) |
| RDS Instance | Amazon RDS | PostgreSQL 15 database (also handles job queue) |
| S3 Buckets | Amazon S3 | File uploads and published assets |
| Secrets | Secrets Manager | Secure credential storage |
| Log Group | CloudWatch | Application logging |

## Configuration Options

Edit `terraform/terraform.tfvars` to customize your deployment:

### Instance Sizing

```hcl
# Database (affects performance and cost)
db_instance_class = "db.t3.micro"    # Development
db_instance_class = "db.t3.small"    # Production
db_instance_class = "db.t3.medium"   # High traffic

# Container resources
web_cpu    = 256   # 0.25 vCPU
web_memory = 512   # 512 MB
api_cpu    = 512   # 0.5 vCPU
api_memory = 1024  # 1 GB
```

### Scaling

```hcl
# Number of running tasks per service
desired_count = 1  # Development
desired_count = 2  # Production with redundancy
```

### Custom Domain with HTTPS

1. Request an ACM certificate in AWS Console
2. Update `terraform.tfvars`:

```hcl
domain_name     = "journal.example.com"
certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/abc123..."
```

3. Run `./deploy.sh`
4. Create a CNAME record: `journal.example.com -> [ALB DNS name]`

### Email Configuration

```hcl
smtp_host = "smtp.sendgrid.net"
smtp_port = 587
smtp_user = "apikey"
smtp_from = "noreply@journal.example.com"
# Set password via: export TF_VAR_smtp_password="your-api-key"
```

## Cost Estimation

| Component | Monthly Cost (min config) |
|-----------|--------------------------|
| RDS db.t3.micro | ~$15 |
| NAT Gateway | ~$32 |
| ALB | ~$16 |
| ECS Fargate (1 task each) | ~$8 |
| S3 | <$1 (depends on usage) |
| CloudWatch | <$1 |
| **Total** | **~$50-65/month** |

Job queue uses PostgreSQL (via graphile-worker) instead of Redis, eliminating ElastiCache costs.

To reduce costs for development:
- Use FARGATE_SPOT capacity provider (set in `ecs.tf`)
- Reduce `desired_count` to 1
- Consider smaller instance types

## Operations

### View Logs

```bash
# Follow all logs
aws logs tail /ecs/my-journal-production --follow

# View specific service logs
aws logs tail /ecs/my-journal-production --log-stream-name-prefix web --follow
aws logs tail /ecs/my-journal-production --log-stream-name-prefix api --follow
```

### Check Service Status

```bash
# View ECS services
aws ecs describe-services \
  --cluster my-journal-production-cluster \
  --services my-journal-production-web my-journal-production-api

# View task status
aws ecs list-tasks --cluster my-journal-production-cluster
```

### Database Access

```bash
# Start a session manager session (requires SSM plugin)
aws ssm start-session --target [task-id]

# Or connect via bastion host / VPN
psql postgresql://colloquium:PASSWORD@rds-endpoint:5432/my_journal
```

### Update Deployment

```bash
# Update Terraform configuration and apply
./deploy.sh

# Force new deployment (pull latest images)
aws ecs update-service \
  --cluster my-journal-production-cluster \
  --service my-journal-production-api \
  --force-new-deployment
```

### Backup Database

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier my-journal-production-postgres \
  --db-snapshot-identifier my-journal-backup-$(date +%Y%m%d)
```

## Security Considerations

1. **Network Isolation**: Database is in private subnets with no public access
2. **Encryption**: S3 buckets use server-side encryption, RDS uses storage encryption
3. **Secrets**: Credentials stored in AWS Secrets Manager, not in environment variables
4. **Security Groups**: Minimal ingress rules - only necessary ports between services
5. **Deletion Protection**: Enabled by default for RDS and ALB

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues and solutions.

## Teardown

To destroy all resources:

```bash
./teardown.sh
```

This will prompt for confirmation before destroying. Note that if `enable_deletion_protection = true`, you'll need to disable it first in `terraform.tfvars`.
