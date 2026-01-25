variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "journal_name" {
  description = "Human-readable name of the journal"
  type        = string
}

variable "journal_slug" {
  description = "URL-friendly identifier for the journal"
  type        = string
}

variable "admin_email" {
  description = "Administrator email address"
  type        = string
}

variable "domain_name" {
  description = "Custom domain name for the journal (optional)"
  type        = string
  default     = ""
}

variable "colloquium_version" {
  description = "Version of Colloquium Docker images to deploy"
  type        = string
  default     = "latest"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 10
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis memory size in GB"
  type        = number
  default     = 1
}

variable "web_cpu" {
  description = "CPU for web container (e.g., '1' or '2')"
  type        = string
  default     = "1"
}

variable "web_memory" {
  description = "Memory for web container (e.g., '512Mi' or '1Gi')"
  type        = string
  default     = "512Mi"
}

variable "api_cpu" {
  description = "CPU for API container"
  type        = string
  default     = "1"
}

variable "api_memory" {
  description = "Memory for API container"
  type        = string
  default     = "1Gi"
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances (0 for scale to zero)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for database"
  type        = bool
  default     = true
}

variable "smtp_host" {
  description = "SMTP server host for sending emails"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = number
  default     = 587
}

variable "smtp_user" {
  description = "SMTP username"
  type        = string
  default     = ""
}

variable "smtp_password" {
  description = "SMTP password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_from" {
  description = "From email address for system emails"
  type        = string
  default     = ""
}

variable "selected_bots" {
  description = "List of bot IDs to enable"
  type        = list(string)
  default     = ["bot-editorial", "bot-markdown-renderer"]
}
