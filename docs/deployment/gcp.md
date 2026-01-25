# GCP Deployment Guide

Deploy Colloquium to Google Cloud Platform using Cloud Run and Cloud SQL.

## Prerequisites

1. **GCP Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Terraform** >= 1.0 installed

### Install Prerequisites

```bash
# Install gcloud CLI (macOS)
brew install google-cloud-sdk

# Install gcloud CLI (Linux)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Authenticate
gcloud auth login

# Set up application default credentials (for Terraform)
gcloud auth application-default login

# Install Terraform (macOS)
brew install terraform

# Install Terraform (Linux)
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

## Quick Start

```bash
# Create a new journal instance for GCP
npx create-colloquium-journal init "My Journal" \
  --deployment gcp \
  --project-id my-gcp-project \
  --region us-central1 \
  --admin-email admin@example.com

# Navigate to the instance directory
cd my-journal-instance

# Edit terraform/terraform.tfvars and verify project_id is set
# Then deploy (takes ~15-20 minutes)
./deploy.sh
```

## Architecture

The GCP deployment creates the following infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Cloud                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                          VPC                               │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                    Cloud Run                          │ │  │
│  │  │  ┌────────────────────┐  ┌────────────────────────┐  │ │  │
│  │  │  │    Web Service     │  │     API Service         │  │ │  │
│  │  │  │  (scale-to-zero)   │  │   (scale-to-zero)       │  │ │  │
│  │  │  └────────────────────┘  └────────────────────────┘  │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                          │                                 │  │
│  │                   VPC Connector                            │  │
│  │                          │                                 │  │
│  │  ┌───────────────────────┴───────────────────────────────┐│  │
│  │  │                    Private Network                     ││  │
│  │  │  ┌─────────────────────────────────────────────────┐  ││  │
│  │  │  │              Cloud SQL PostgreSQL 15            │  ││  │
│  │  │  │           (Database + Job Queues)               │  ││  │
│  │  │  └─────────────────────────────────────────────────┘  ││  │
│  │  └───────────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Cloud Storage │  │ Cloud Storage │  │   Secret Manager    │   │
│  │   (uploads)   │  │  (published)  │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Resources Created

| Resource | GCP Service | Purpose |
|----------|-------------|---------|
| VPC Network | Compute Engine | Network isolation |
| VPC Connector | Serverless VPC Access | Connect Cloud Run to private network |
| Cloud SQL | Cloud SQL for PostgreSQL | PostgreSQL 15 database (also handles job queue) |
| Web Service | Cloud Run | Next.js web application |
| API Service | Cloud Run | Express.js API server |
| Uploads Bucket | Cloud Storage | Private file uploads |
| Published Bucket | Cloud Storage | Public published assets |
| Secrets | Secret Manager | Secure credential storage |
| Service Account | IAM | Cloud Run identity |

## Configuration Options

Edit `terraform/terraform.tfvars` to customize your deployment:

### Instance Sizing

```hcl
# Database (affects performance and cost)
db_tier = "db-f1-micro"        # Development (~$7/month)
db_tier = "db-g1-small"        # Production (~$25/month)
db_tier = "db-custom-1-3840"   # High traffic (~$50/month)

# Container resources
web_cpu    = "1"       # 1 vCPU
web_memory = "512Mi"   # 512 MB
api_cpu    = "1"       # 1 vCPU
api_memory = "1Gi"     # 1 GB
```

### Scaling

```hcl
# Scale-to-zero for cost savings
min_instances = 0    # Containers scale to zero when idle
max_instances = 10   # Maximum concurrent instances
```

### Custom Domain

1. Update `terraform.tfvars`:

```hcl
domain_name = "journal.example.com"
```

2. Run `./deploy.sh`
3. Configure DNS:
   - Create a CNAME record: `journal.example.com -> ghs.googlehosted.com`
4. Cloud Run automatically provisions SSL certificates

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
| Cloud SQL db-f1-micro | ~$7 |
| VPC Connector | ~$6 |
| Cloud Run | Pay-per-use (scale-to-zero) |
| Cloud Storage | <$1 (depends on usage) |
| Cloud Logging | <$1 |
| **Total** | **~$15-20/month** |

Key advantages:
- Cloud Run's scale-to-zero means you only pay for actual usage
- Job queue uses PostgreSQL (via graphile-worker) instead of Redis, eliminating Memorystore costs

## Operations

### View Logs

```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision" \
  --project my-gcp-project \
  --limit 100

# Stream logs
gcloud beta run services logs tail my-journal-production-api \
  --project my-gcp-project
```

### Check Service Status

```bash
# List Cloud Run services
gcloud run services list --project my-gcp-project

# Describe a service
gcloud run services describe my-journal-production-api \
  --region us-central1 \
  --project my-gcp-project
```

### Database Access

```bash
# Connect via Cloud SQL Auth Proxy
cloud-sql-proxy my-gcp-project:us-central1:my-journal-production-postgres

# In another terminal
psql "host=127.0.0.1 port=5432 user=colloquium dbname=my_journal"
```

### Update Deployment

```bash
# Update Terraform configuration and apply
./deploy.sh

# Force new deployment (pull latest images)
gcloud run services update my-journal-production-api \
  --region us-central1 \
  --project my-gcp-project
```

### Backup Database

```bash
# Create on-demand backup
gcloud sql backups create \
  --instance my-journal-production-postgres \
  --project my-gcp-project

# List backups
gcloud sql backups list \
  --instance my-journal-production-postgres \
  --project my-gcp-project
```

## Security Considerations

1. **Network Isolation**: Database and Redis use private IPs, not accessible from internet
2. **VPC Connector**: Secure connection between Cloud Run and private resources
3. **Secrets**: Credentials stored in Secret Manager, injected at runtime
4. **IAM**: Minimal permissions via dedicated service account
5. **Public Buckets**: Only the `published/` prefix is publicly readable
6. **Deletion Protection**: Enabled by default for Cloud SQL

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues and solutions.

## Teardown

To destroy all resources:

```bash
./teardown.sh
```

This will prompt for confirmation before destroying. Note that if `enable_deletion_protection = true`, you'll need to disable it first in `terraform.tfvars`.

## GCP-Specific Notes

### Billing Alerts

Set up billing alerts to avoid surprises:

```bash
gcloud billing budgets create \
  --billing-account BILLING_ACCOUNT_ID \
  --display-name "Colloquium Journal Budget" \
  --budget-amount 100USD \
  --threshold-rules percent=50 \
  --threshold-rules percent=90 \
  --threshold-rules percent=100
```

### Cold Start Optimization

If cold starts are an issue, set `min_instances = 1` to keep at least one container warm. This increases costs but improves response times.

### Region Selection

Choose a region close to your users:
- `us-central1` - Iowa, USA
- `europe-west1` - Belgium
- `asia-east1` - Taiwan

Full list: https://cloud.google.com/run/docs/locations
