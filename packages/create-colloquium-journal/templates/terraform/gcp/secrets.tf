resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.name_prefix}-database-url"

  replication {
    auto {}
  }

  labels = local.common_labels

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://colloquium:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${replace(var.journal_slug, "-", "_")}?sslmode=require"
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.name_prefix}-jwt-secret"

  replication {
    auto {}
  }

  labels = local.common_labels

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

resource "google_secret_manager_secret" "magic_link_secret" {
  secret_id = "${local.name_prefix}-magic-link-secret"

  replication {
    auto {}
  }

  labels = local.common_labels

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "magic_link_secret" {
  secret      = google_secret_manager_secret.magic_link_secret.id
  secret_data = random_password.magic_link_secret.result
}

resource "google_secret_manager_secret" "smtp_password" {
  secret_id = "${local.name_prefix}-smtp-password"

  replication {
    auto {}
  }

  labels = local.common_labels

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "smtp_password" {
  secret      = google_secret_manager_secret.smtp_password.id
  secret_data = var.smtp_password != "" ? var.smtp_password : "placeholder"
}

resource "google_secret_manager_secret_iam_member" "database_url_access" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun.email}"
}

resource "google_secret_manager_secret_iam_member" "jwt_secret_access" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun.email}"
}

resource "google_secret_manager_secret_iam_member" "magic_link_secret_access" {
  secret_id = google_secret_manager_secret.magic_link_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun.email}"
}

resource "google_secret_manager_secret_iam_member" "smtp_password_access" {
  secret_id = google_secret_manager_secret.smtp_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun.email}"
}
