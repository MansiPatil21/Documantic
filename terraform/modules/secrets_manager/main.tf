# ── AWS Secrets Manager — securely stores the Groq API key ───────────────────

resource "aws_secretsmanager_secret" "groq_api_key" {
  name                    = "${var.name_prefix}-groq-api-key"
  description             = "Groq API key for Documantic AI processing"
  recovery_window_in_days = 0 # Allow immediate deletion in dev/lab

  tags = {
    Project = "Documantic"
  }
}

resource "aws_secretsmanager_secret_version" "groq_api_key" {
  secret_id     = aws_secretsmanager_secret.groq_api_key.id
  secret_string = var.groq_api_key
}
