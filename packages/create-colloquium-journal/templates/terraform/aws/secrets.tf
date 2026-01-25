resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${local.name_prefix}/app-secrets"
  recovery_window_in_days = var.environment == "production" ? 30 : 0

  tags = {
    Name = "${local.name_prefix}-app-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    DATABASE_URL      = "postgresql://colloquium:${random_password.db_password.result}@${aws_db_instance.main.endpoint}/${replace(var.journal_slug, "-", "_")}?sslmode=require"
    JWT_SECRET        = random_password.jwt_secret.result
    MAGIC_LINK_SECRET = random_password.magic_link_secret.result
    DB_PASSWORD       = random_password.db_password.result
    SMTP_PASSWORD     = var.smtp_password
  })
}

resource "aws_cloudwatch_log_group" "main" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = var.environment == "production" ? 90 : 14

  tags = {
    Name = "${local.name_prefix}-logs"
  }
}
