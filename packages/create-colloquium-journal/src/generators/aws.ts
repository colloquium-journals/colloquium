import fs from 'fs-extra';
import path from 'path';
import { JournalConfig, CloudTemplateContext } from '../types';

export async function generateAWSInstance(config: JournalConfig, targetDir: string): Promise<void> {
  const templateDir = path.join(__dirname, '..', '..', 'templates', 'terraform', 'aws');

  await fs.ensureDir(targetDir);

  const terraformDir = path.join(targetDir, 'terraform');
  await fs.ensureDir(terraformDir);

  const context = createAWSContext(config);

  await copyTerraformFiles(templateDir, terraformDir);
  await generateTerraformVars(terraformDir, config);
  await generateDeployScript(targetDir, 'aws');
  await generateTeardownScript(targetDir, 'aws');
  await generateConfigFile(targetDir, config);
  await generateAWSReadme(targetDir, config);
}

function createAWSContext(config: JournalConfig): CloudTemplateContext {
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
    AWS_REGION: config.aws?.region || 'us-east-1',
    AWS_DB_INSTANCE_CLASS: config.aws?.dbInstanceClass || 'db.t3.micro',
    AWS_CERTIFICATE_ARN: config.aws?.certificateArn || '',
    SMTP_HOST: config.aws?.smtpHost || '',
    SMTP_PORT: config.aws?.smtpPort?.toString() || '587',
    SMTP_USER: config.aws?.smtpUser || '',
    SMTP_FROM: config.aws?.smtpFrom || '',
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
  const tfvars = `# Colloquium AWS Deployment Configuration
# Generated: ${config.createdAt}

# AWS Configuration
aws_region = "${config.aws?.region || 'us-east-1'}"
environment = "production"

# Journal Configuration
journal_name  = "${config.name}"
journal_slug  = "${config.slug}"
admin_email   = "${config.adminEmail}"
${config.domain ? `domain_name   = "${config.domain}"` : '# domain_name = ""  # Uncomment and set for custom domain'}
${config.aws?.certificateArn ? `certificate_arn = "${config.aws.certificateArn}"` : '# certificate_arn = ""  # Required for HTTPS with custom domain'}

# Infrastructure Sizing
db_instance_class = "${config.aws?.dbInstanceClass || 'db.t3.micro'}"

# Container Resources
web_cpu    = 256
web_memory = 512
api_cpu    = 512
api_memory = 1024

# Scaling
desired_count = 1

# Bots
selected_bots = [${config.selectedBots.map(b => `"${b}"`).join(', ')}]

# Email Configuration (uncomment and configure for production)
${config.aws?.smtpHost ? `smtp_host = "${config.aws.smtpHost}"` : '# smtp_host = ""'}
${config.aws?.smtpPort ? `smtp_port = ${config.aws.smtpPort}` : '# smtp_port = 587'}
${config.aws?.smtpUser ? `smtp_user = "${config.aws.smtpUser}"` : '# smtp_user = ""'}
${config.aws?.smtpFrom ? `smtp_from = "${config.aws.smtpFrom}"` : '# smtp_from = ""'}
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
echo "  Colloquium ${provider.toUpperCase()} Deployment"
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

  ${provider === 'aws' ? `
  if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI is not installed"
    echo "Install from: https://aws.amazon.com/cli/"
    exit 1
  fi

  if ! aws sts get-caller-identity &> /dev/null; then
    echo "ERROR: AWS CLI is not configured"
    echo "Run: aws configure"
    exit 1
  fi
  ` : `
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
  `}

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
echo "  Colloquium ${provider.toUpperCase()} Teardown"
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
      type: 'aws',
      region: config.aws?.region,
    },
    instanceId: config.instanceId,
    createdAt: config.createdAt,
  };

  await fs.writeJSON(path.join(configDir, 'journal.json'), journalConfig, { spaces: 2 });
}

async function generateAWSReadme(targetDir: string, config: JournalConfig): Promise<void> {
  const readme = `# ${config.name} - AWS Deployment

A Colloquium journal instance deployed on AWS.

## Prerequisites

1. **AWS Account** with admin permissions
2. **AWS CLI** installed and configured (\`aws configure\`)
3. **Terraform** >= 1.0 installed

## Quick Start

\`\`\`bash
# Deploy the infrastructure
./deploy.sh
\`\`\`

## Configuration

Edit \`terraform/terraform.tfvars\` to customize:

- **Instance sizes**: \`db_instance_class\`
- **Container resources**: \`web_cpu\`, \`web_memory\`, \`api_cpu\`, \`api_memory\`
- **Custom domain**: \`domain_name\`, \`certificate_arn\`
- **Email**: \`smtp_host\`, \`smtp_port\`, \`smtp_user\`, \`smtp_from\`

## Resources Created

| Resource | Service | Purpose |
|----------|---------|---------|
| VPC | Amazon VPC | Network isolation |
| RDS | PostgreSQL 15 | Database + Job queues |
| ECS Fargate | Containers | Web & API services |
| ALB | Load Balancer | Traffic routing |
| S3 | Object Storage | File uploads |
| Secrets Manager | Secrets | Credentials |
| CloudWatch | Logs | Application logs |

## Estimated Costs

- **Minimum config**: ~$50-65/month
- Main costs: RDS (~$15), NAT Gateway (~$32), ALB (~$16)
- Job queues use PostgreSQL (graphile-worker), no Redis needed

## Custom Domain Setup

1. Request an ACM certificate in AWS Console
2. Add the certificate ARN to \`terraform.tfvars\`:
   \`\`\`hcl
   domain_name     = "journal.example.com"
   certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/..."
   \`\`\`
3. Run \`./deploy.sh\` again
4. Create a CNAME record pointing your domain to the ALB DNS name

## Useful Commands

\`\`\`bash
# View deployment outputs
cd terraform && terraform output

# View logs
aws logs tail /ecs/${config.slug}-production --follow

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
│   ├── rds.tf            # Database
│   ├── ecs.tf            # Container services
│   ├── alb.tf            # Load balancer
│   ├── s3.tf             # Storage buckets
│   ├── secrets.tf        # Secrets Manager
│   ├── iam.tf            # IAM roles
│   └── terraform.tfvars  # Your configuration
├── config/
│   └── journal.json      # Journal metadata
└── README.md             # This file
\`\`\`

## Support

- Documentation: https://docs.colloquium.org/deployment/aws
- Issues: https://github.com/colloquium/colloquium/issues
`;

  await fs.writeFile(path.join(targetDir, 'README.md'), readme);
}
