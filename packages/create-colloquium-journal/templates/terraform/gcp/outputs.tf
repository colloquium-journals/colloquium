output "web_url" {
  description = "URL to access the web application (use cloud_run_web_url if domain not configured)"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "See cloud_run_web_url output"
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

    1. Access your journal at the web_url output above

    2. If NOT using a custom domain, update Cloud Run environment variables:
       - Web service: Set NEXT_PUBLIC_API_URL to the cloud_run_api_url output
       - API service: Set FRONTEND_URL to the cloud_run_web_url output
       - API service: Set API_URL to the cloud_run_api_url output

       Run: gcloud run services update ${local.name_prefix}-web --region ${var.region} --update-env-vars "NEXT_PUBLIC_API_URL=<api-url>"
       Run: gcloud run services update ${local.name_prefix}-api --region ${var.region} --update-env-vars "FRONTEND_URL=<web-url>,API_URL=<api-url>"

    3. If using a custom domain, add these DNS records:
       - CNAME: ${var.domain_name} -> ghs.googlehosted.com

    4. View Cloud Run services:
       gcloud run services list --project ${var.project_id}

    5. View logs:
       gcloud logging read "resource.type=cloud_run_revision" --project ${var.project_id} --limit 50

    6. The first user to sign up with ${var.admin_email} will be granted admin privileges.

  EOT
}
