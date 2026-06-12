# ── SNS Topic — publishes job completion notifications ────────────────────────

resource "aws_sns_topic" "job_complete" {
  name = "${var.name_prefix}-job-complete"

  tags = {
    Project = "Documantic"
  }
}

# SES email subscription — SNS sends email via SES when job completes
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.job_complete.arn
  protocol  = "email"
  endpoint  = var.ses_sender_email
}
