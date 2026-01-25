variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
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

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (required if domain_name is set)"
  type        = string
  default     = ""
}

variable "colloquium_version" {
  description = "Version of Colloquium Docker images to deploy"
  type        = string
  default     = "latest"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "web_cpu" {
  description = "CPU units for web container (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Memory for web container in MB"
  type        = number
  default     = 512
}

variable "api_cpu" {
  description = "CPU units for API container (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory for API container in MB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of tasks for each service"
  type        = number
  default     = 1
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for database and load balancer"
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
