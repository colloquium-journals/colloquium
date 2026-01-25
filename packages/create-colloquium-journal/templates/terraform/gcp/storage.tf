resource "google_storage_bucket" "uploads" {
  name     = "${local.name_prefix}-uploads-${data.google_project.current.number}"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = var.environment == "production"
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }

  labels = local.common_labels
}

resource "google_storage_bucket" "published" {
  name     = "${local.name_prefix}-published-${data.google_project.current.number}"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  versioning {
    enabled = true
  }

  labels = local.common_labels
}

resource "google_storage_bucket_iam_member" "published_public" {
  bucket = google_storage_bucket.published.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket_iam_member" "uploads_cloudrun" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloudrun.email}"
}

resource "google_storage_bucket_iam_member" "published_cloudrun" {
  bucket = google_storage_bucket.published.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloudrun.email}"
}
