resource "google_sql_database_instance" "main" {
  name             = "${local.name_prefix}-postgres"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "production"
      backup_retention_settings {
        retained_backups = var.environment == "production" ? 7 : 1
      }
    }

    maintenance_window {
      day          = 1
      hour         = 4
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = var.environment == "production"
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    user_labels = local.common_labels
  }

  deletion_protection = var.enable_deletion_protection

  depends_on = [google_service_networking_connection.private_vpc]
}

resource "google_sql_database" "main" {
  name     = replace(var.journal_slug, "-", "_")
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = "colloquium"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}
