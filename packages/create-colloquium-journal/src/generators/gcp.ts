import fs from 'fs-extra';
import path from 'path';
import { JournalConfig, CloudTemplateContext } from '../types';

export async function generateGCPInstance(config: JournalConfig, targetDir: string): Promise<void> {
  const templateDir = path.join(__dirname, '..', '..', 'templates', 'terraform', 'gcp');

  await fs.ensureDir(targetDir);

  const terraformDir = path.join(targetDir, 'terraform');
  await fs.ensureDir(terraformDir);

  const context = createGCPContext(config);

  await copyTerraformFiles(templateDir, terraformDir);
  await generateTerraformVars(terraformDir, config);
  await generateDeployScript(targetDir, 'gcp');
  await generateTeardownScript(targetDir, 'gcp');
  await generateConfigFile(targetDir, config);
  await generateGCPReadme(targetDir, config);
}

function createGCPContext(config: JournalConfig): CloudTemplateContext {
  return {
    JOURNAL_NAME: config.name,
    JOURNAL_SLUG: config.slug,
    JOURNAL_DESCRIPTION: config.description || '',
    JOURNAL_DOMAIN: config.domain || '',
    ADMIN_EMAIL: config.adminEmail,
    ADMIN_NAME: config.adminName,
    DB_PASSWORD: config.dbPassword,
    DB_NAME: config.dbName,
    JWT_SECRET: config.jwtSecret,
    MAGIC_LINK_SECRET: config.magicLinkSecret,
    SELECTED_BOTS: config.selectedBots.join(','),
    INSTANCE_ID: config.instanceId,
    CREATED_AT: config.createdAt,
    GCP_PROJECT_ID: config.gcp?.projectId || '',
    GCP_REGION: config.gcp?.region || 'us-central1',
    GCP_DB_TIER: config.gcp?.dbTier || 'db-f1-micro',
    SMTP_HOST: config.gcp?.smtpHost || '',
    SMTP_PORT: config.gcp?.smtpPort?.toString() || '587',
    SMTP_USER: config.gcp?.smtpUser || '',
    SMTP_FROM: config.gcp?.smtpFrom || '',
  };
}

async function copyTerraformFiles(sourceDir: string, targetDir: string): Promise<void> {
  const files = await fs.readdir(sourceDir);

  for (const file of files) {
    if (file.endsWith('.tf')) {
      await fs.copy(path.join(sourceDir, file), path.join(targetDir, file));
    }
  }
}

async function generateTerraformVars(targetDir: string, config: JournalConfig): Promise<void> {
  const tfvars = `# Colloquium GCP Deployment Configuration
# Generated: ${config.createdAt}

# GCP Configuration
project_id  = "${config.gcp?.projectId || 'YOUR_PROJECT_ID'}"
region      = "${config.gcp?.region || 'us-central1'}"
environment = "production"

# Journal Configuration
journal_name = "${config.name}"
journal_slug = "${config.slug}"
admin_email  = "${config.adminEmail}"
${config.domain ? `domain_name  = "${config.domain}"` : '# domain_name = ""  # Uncomment and set for custom domain'}

# Infrastructure Sizing
db_tier = "${config.gcp?.dbTier || 'db-f1-micro'}"

# Container Resources
web_cpu    = "1"
web_memory = "512Mi"
api_cpu    = "1"
api_memory = "1Gi"

# Scaling (0 enables scale-to-zero)
min_instances = 0
max_instances = 10

# Bots
selected_bots = [${config.selectedBots.map(b => `"${b}"`).join(', ')}]

# Email Configuration (uncomment and configure for production)
${config.gcp?.smtpHost ? `smtp_host = "${config.gcp.smtpHost}"` : '# smtp_host = ""'}
${config.gcp?.smtpPort ? `smtp_port = ${config.gcp.smtpPort}` : '# smtp_port = 587'}
${config.gcp?.smtpUser ? `smtp_user = "${config.gcp.smtpUser}"` : '# smtp_user = ""'}
${config.gcp?.smtpFrom ? `smtp_from = "${config.gcp.smtpFrom}"` : '# smtp_from = ""'}
# smtp_password = ""  # Set via environment variable TF_VAR_smtp_password

# Security (set to false only for testing)
enable_deletion_protection = true
`;

  await fs.writeFile(path.join(targetDir, 'terraform.tfvars'), tfvars);
}

async function generateDeployScript(targetDir: string, provider: string): Promise<void> {
  const script = `#!/bin/bash
set -e

echo "=========================================="
echo "  Colloquium GCP Deployment"
echo "=========================================="
echo ""

# Check prerequisites
check_prerequisites() {
  echo "Checking prerequisites..."

  if ! command -v terraform &> /dev/null; then
    echo "ERROR: Terraform is not installed"
    echo "Install from: https://www.terraform.io/downloads"
    exit 1
  fi

  if ! command -v gcloud &> /dev/null; then
    echo "ERROR: Google Cloud SDK is not installed"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi

  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 &> /dev/null; then
    echo "ERROR: gcloud is not authenticated"
    echo "Run: gcloud auth login"
    exit 1
  fi

  # Check project ID is set
  PROJECT_ID=$(grep 'project_id' terraform/terraform.tfvars | sed 's/.*= *"\\(.*\\)".*/\\1/')
  if [ "$PROJECT_ID" == "YOUR_PROJECT_ID" ]; then
    echo "ERROR: Please set your GCP project ID in terraform/terraform.tfvars"
    exit 1
  fi

  # Set the project
  gcloud config set project "$PROJECT_ID"

  echo "All prerequisites met!"
  echo ""
}

# Initialize Terraform
init_terraform() {
  echo "Initializing Terraform..."
  cd terraform
  terraform init
  cd ..
  echo ""
}

# Plan deployment
plan_deployment() {
  echo "Planning deployment..."
  cd terraform
  terraform plan -out=tfplan
  cd ..
  echo ""
}

# Apply deployment
apply_deployment() {
  echo "Applying deployment..."
  cd terraform
  terraform apply tfplan
  cd ..
  echo ""
}

# Main deployment flow
main() {
  check_prerequisites
  init_terraform

  echo "Ready to deploy. This will create cloud resources."
  read -p "Continue? (y/N) " -n 1 -r
  echo ""

  if [[ \$REPLY =~ ^[Yy]$ ]]; then
    plan_deployment
    apply_deployment

    echo ""
    echo "=========================================="
    echo "  Deployment Complete!"
    echo "=========================================="
    cd terraform
    terraform output -json > ../deployment-outputs.json
    echo ""
    terraform output next_steps
    cd ..
  else
    echo "Deployment cancelled."
    exit 0
  fi
}

main
`;

  const scriptPath = path.join(targetDir, 'deploy.sh');
  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, '755');
}

async function generateTeardownScript(targetDir: string, provider: string): Promise<void> {
  const script = `#!/bin/bash
set -e

echo "=========================================="
echo "  Colloquium GCP Teardown"
echo "=========================================="
echo ""
echo "WARNING: This will DESTROY all cloud resources!"
echo "This action cannot be undone."
echo ""

read -p "Type 'destroy' to confirm: " confirmation

if [ "\$confirmation" != "destroy" ]; then
  echo "Teardown cancelled."
  exit 0
fi

echo ""
echo "Destroying resources..."

cd terraform
terraform destroy -auto-approve
cd ..

echo ""
echo "=========================================="
echo "  Teardown Complete"
echo "=========================================="
`;

  const scriptPath = path.join(targetDir, 'teardown.sh');
  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, '755');
}

async function generateConfigFile(targetDir: string, config: JournalConfig): Promise<void> {
  const configDir = path.join(targetDir, 'config');
  await fs.ensureDir(configDir);

  const journalConfig = {
    name: config.name,
    slug: config.slug,
    description: config.description,
    domain: config.domain,
    adminEmail: config.adminEmail,
    selectedBots: config.selectedBots,
    deployment: {
      type: 'gcp',
      projectId: config.gcp?.projectId,
      region: config.gcp?.region,
    },
    instanceId: config.instanceId,
    createdAt: config.createdAt,
  };

  await fs.writeJSON(path.join(configDir, 'journal.json'), journalConfig, { spaces: 2 });
}

async function generateGCPReadme(targetDir: string, config: JournalConfig): Promise<void> {
  const readme = `# ${config.name} - GCP Deployment

A Colloquium journal instance deployed on Google Cloud Platform.

## Prerequisites

1. **GCP Project** with billing enabled
2. **gcloud CLI** installed and authenticated (\`gcloud auth login\`)
3. **Terraform** >= 1.0 installed

## Quick Start

1. Edit \`terraform/terraform.tfvars\` and set your \`project_id\`
2. Run the deployment:
   \`\`\`bash
   ./deploy.sh
   \`\`\`

## Configuration

Edit \`terraform/terraform.tfvars\` to customize:

- **Instance sizes**: \`db_tier\`
- **Container resources**: \`web_cpu\`, \`web_memory\`, \`api_cpu\`, \`api_memory\`
- **Scaling**: \`min_instances\` (0 for scale-to-zero), \`max_instances\`
- **Custom domain**: \`domain_name\`
- **Email**: \`smtp_host\`, \`smtp_port\`, \`smtp_user\`, \`smtp_from\`

## Resources Created

| Resource | Service | Purpose |
|----------|---------|---------|
| VPC | Compute Engine | Network isolation |
| Cloud SQL | PostgreSQL 15 | Database + Job queues |
| Cloud Run | Containers | Web & API services |
| Cloud Storage | Object Storage | File uploads |
| Secret Manager | Secrets | Credentials |
| Cloud Logging | Logs | Application logs |

## Estimated Costs

- **Minimum config**: ~$15-20/month (scale-to-zero helps reduce costs)
- Main costs: Cloud SQL (~$7), VPC Connector (~$6)
- Cloud Run charges only for actual usage
- Job queues use PostgreSQL (graphile-worker), no Redis needed

## Custom Domain Setup

1. Add your domain to \`terraform.tfvars\`:
   \`\`\`hcl
   domain_name = "journal.example.com"
   \`\`\`
2. Run \`./deploy.sh\` again
3. Configure your DNS:
   - Create a CNAME record: \`journal.example.com -> ghs.googlehosted.com\`

## Useful Commands

\`\`\`bash
# View deployment outputs
cd terraform && terraform output

# View logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# List Cloud Run services
gcloud run services list

# Update deployment
./deploy.sh

# Destroy all resources
./teardown.sh
\`\`\`

## File Structure

\`\`\`
${config.slug}-instance/
├── deploy.sh              # One-command deployment
├── teardown.sh            # Destroy all resources
├── terraform/
│   ├── main.tf           # Provider configuration
│   ├── variables.tf      # Input variables
│   ├── outputs.tf        # Output values
│   ├── vpc.tf            # Network resources
│   ├── cloudsql.tf       # Database
│   ├── cloudrun.tf       # Container services
│   ├── storage.tf        # Storage buckets
│   ├── secrets.tf        # Secret Manager
│   ├── iam.tf            # Service accounts
│   └── terraform.tfvars  # Your configuration
├── config/
│   └── journal.json      # Journal metadata
└── README.md             # This file
\`\`\`

## Support

- Documentation: https://docs.colloquium.org/deployment/gcp
- Issues: https://github.com/colloquium/colloquium/issues
`;

  await fs.writeFile(path.join(targetDir, 'README.md'), readme);
}
