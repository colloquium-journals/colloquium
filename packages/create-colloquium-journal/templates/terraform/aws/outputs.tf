output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "web_url" {
  description = "URL to access the web application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}

output "api_url" {
  description = "URL to access the API"
  value       = var.domain_name != "" ? "https://${var.domain_name}/api" : "http://${aws_lb.main.dns_name}/api"
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for file uploads"
  value       = aws_s3_bucket.uploads.id
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "web_service_name" {
  description = "Name of the web ECS service"
  value       = aws_ecs_service.web.name
}

output "api_service_name" {
  description = "Name of the API ECS service"
  value       = aws_ecs_service.api.name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.main.name
}

output "secrets_manager_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "admin_email" {
  description = "Administrator email address"
  value       = var.admin_email
}

output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    Deployment complete! Next steps:

    1. Access your journal at: ${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"}

    2. If using a custom domain, create a CNAME record:
       ${var.domain_name} -> ${aws_lb.main.dns_name}

    3. Check the ECS service status:
       aws ecs describe-services --cluster ${aws_ecs_cluster.main.name} --services ${aws_ecs_service.web.name} ${aws_ecs_service.api.name}

    4. View logs:
       aws logs tail ${aws_cloudwatch_log_group.main.name} --follow

    5. The first user to sign up with ${var.admin_email} will be granted admin privileges.

  EOT
}
