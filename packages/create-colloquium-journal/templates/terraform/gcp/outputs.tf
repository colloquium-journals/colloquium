output "web_url" {
  description = "URL to access the web application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : google_cloud_run_v2_service.web.uri
}

output "api_url" {
  description = "URL to access the API"
  value       = google_cloud_run_v2_service.api.uri
}

output "cloud_run_web_url" {
  description = "Cloud Run URL for web service"
  value       = google_cloud_run_v2_service.web.uri
}

output "cloud_run_api_url" {
  description = "Cloud Run URL for API service"
  value       = google_cloud_run_v2_service.api.uri
}

output "storage_bucket_name" {
  description = "Name of the Cloud Storage bucket for file uploads"
  value       = google_storage_bucket.uploads.name
}

output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.main.connection_name
  sensitive   = true
}

output "redis_host" {
  description = "Memorystore Redis host"
  value       = google_redis_instance.main.host
  sensitive   = true
}

output "vpc_connector_name" {
  description = "VPC connector name for serverless services"
  value       = google_vpc_access_connector.main.name
}

output "service_account_email" {
  description = "Service account email for Cloud Run services"
  value       = google_service_account.cloudrun.email
}

output "admin_email" {
  description = "Administrator email address"
  value       = var.admin_email
}

output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    Deployment complete! Next steps:

    1. Access your journal at: ${var.domain_name != "" ? "https://${var.domain_name}" : google_cloud_run_v2_service.web.uri}

    2. If using a custom domain, add these DNS records:
       - CNAME: ${var.domain_name} -> ghs.googlehosted.com

    3. View Cloud Run services:
       gcloud run services list --project ${var.project_id}

    4. View logs:
       gcloud logging read "resource.type=cloud_run_revision" --project ${var.project_id} --limit 50

    5. The first user to sign up with ${var.admin_email} will be granted admin privileges.

  EOT
}
