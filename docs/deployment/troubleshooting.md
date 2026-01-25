# Deployment Troubleshooting Guide

Common issues and solutions for AWS and GCP deployments.

## General Issues

### Terraform Init Fails

**Symptom**: `terraform init` fails with provider errors

**Solutions**:
1. Ensure Terraform >= 1.0 is installed: `terraform version`
2. Clear the provider cache: `rm -rf .terraform && terraform init`
3. Check internet connectivity

### Terraform Apply Fails with Timeout

**Symptom**: Resources take too long to create

**Solutions**:
1. Some resources (especially databases) can take 10-15 minutes
2. Run `terraform apply` again - it will continue from where it left off
3. Check cloud provider quotas

### Services Not Starting

**Symptom**: Containers start but immediately crash

**Solutions**:
1. Check logs for error messages
2. Verify environment variables are set correctly
3. Ensure database migrations have run
4. Check memory limits - increase if seeing OOM errors

---

## AWS-Specific Issues

### "Access Denied" Errors

**Symptom**: Terraform fails with AWS permission errors

**Solutions**:
1. Verify AWS credentials: `aws sts get-caller-identity`
2. Ensure your IAM user/role has admin permissions
3. Check if MFA is required for your account

### ECS Tasks Failing to Start

**Symptom**: Tasks in STOPPED state

**Check**:
```bash
aws ecs describe-tasks \
  --cluster my-journal-production-cluster \
  --tasks $(aws ecs list-tasks --cluster my-journal-production-cluster --query 'taskArns[0]' --output text)
```

**Common Causes**:
1. **Image pull failures**: Ensure container registry is accessible
2. **Secret access**: Check ECS task role has Secrets Manager permissions
3. **Health check failures**: Increase `startPeriod` in health check config
4. **Resource limits**: Increase CPU/memory if tasks are OOM-killed

### ALB Returns 502/504 Errors

**Symptom**: Application Load Balancer returns bad gateway errors

**Solutions**:
1. Check target group health: Console > EC2 > Target Groups
2. Verify security groups allow traffic from ALB to ECS
3. Check ECS service logs for startup errors
4. Ensure health check path returns 200 OK

### RDS Connection Refused

**Symptom**: API cannot connect to database

**Check**:
1. Security group allows port 5432 from ECS security group
2. Database is in the same VPC as ECS
3. DATABASE_URL secret is correctly formatted

### NAT Gateway Costs

**Issue**: NAT Gateway is expensive (~$32/month)

**Solutions**:
1. For development, consider VPC endpoints instead
2. Use a NAT instance for lower costs (less reliable)
3. Accept the cost for production reliability

---

## GCP-Specific Issues

### "Permission Denied" Errors

**Symptom**: Terraform fails with GCP permission errors

**Solutions**:
1. Verify authentication: `gcloud auth list`
2. Set application default credentials: `gcloud auth application-default login`
3. Ensure project ID is correct: `gcloud config get-value project`
4. Check IAM roles include Owner or Editor

### APIs Not Enabled

**Symptom**: "API not enabled" errors

**Solution**: Terraform should enable APIs automatically, but you can manually enable:
```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  compute.googleapis.com \
  --project YOUR_PROJECT_ID
```

### Cloud Run Service Unavailable

**Symptom**: 503 Service Unavailable errors

**Check**:
```bash
gcloud run services describe my-journal-production-api \
  --region us-central1 \
  --format="value(status.conditions)"
```

**Common Causes**:
1. **Container crash**: Check logs for startup errors
2. **VPC connector issues**: Verify connector is healthy
3. **Secret access**: Check service account permissions
4. **Cold start timeout**: Increase startup timeout

### Cloud SQL Connection Issues

**Symptom**: Cannot connect to database from Cloud Run

**Solutions**:
1. Verify VPC connector is attached to Cloud Run service
2. Check private IP is enabled on Cloud SQL instance
3. Ensure service account has `cloudsql.client` role
4. Verify Cloud SQL and Cloud Run are in the same region

### Cold Start Latency

**Issue**: First request after idle period is slow

**Solutions**:
1. Set `min_instances = 1` to keep one container warm
2. Optimize container startup time
3. Use Cloud Run's CPU allocation setting for "always allocated"

---

## Database Issues

### Migrations Fail

**Symptom**: Database schema errors

**Solutions**:
1. Manually run migrations:
   ```bash
   # Connect to database
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```
2. Check for pending migrations in source code
3. Verify database user has CREATE permissions

### Database Performance

**Symptom**: Slow queries

**Solutions**:
1. Enable performance insights (AWS) or Query Insights (GCP)
2. Upgrade instance tier
3. Add indexes for frequent queries
4. Check for N+1 query patterns

---

## Networking Issues

### Cannot Access From Internet

**Symptom**: Application unreachable

**Checklist**:
1. Load balancer exists and is healthy
2. DNS records point to correct endpoint
3. Security groups/firewall rules allow inbound traffic
4. SSL certificate is valid (for HTTPS)

### Internal Service Communication Fails

**Symptom**: Web cannot reach API

**Solutions**:
1. Verify API_URL environment variable is correct
2. Check security groups allow internal traffic
3. Ensure services are in the same VPC

---

## Secret Management Issues

### Secrets Not Loading

**Symptom**: Environment variables are empty

**AWS Solutions**:
1. Check ECS task execution role has Secrets Manager permissions
2. Verify secret ARN in task definition
3. Ensure secret version exists (not just secret name)

**GCP Solutions**:
1. Check service account has `secretmanager.secretAccessor` role
2. Verify secret name matches exactly
3. Ensure secret has at least one version

---

## Getting Help

If you're still stuck:

1. **Check logs** - Most issues are visible in CloudWatch (AWS) or Cloud Logging (GCP)
2. **Terraform state** - Run `terraform show` to see current state
3. **GitHub Issues** - Search or create issue at https://github.com/colloquium/colloquium/issues
4. **Discussions** - Ask questions at https://github.com/colloquium/colloquium/discussions

When reporting issues, include:
- Cloud provider (AWS/GCP)
- Terraform version
- Error messages (redact sensitive info)
- Relevant log excerpts
