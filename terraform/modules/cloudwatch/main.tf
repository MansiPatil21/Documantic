# ── Log groups for each Lambda function ───────────────────────────────────────

resource "aws_cloudwatch_log_group" "processor" {
  name              = "/aws/lambda/${var.processor_lambda_name}"
  retention_in_days = 7

  tags = {
    Project = "Documantic"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.api_lambda_name}"
  retention_in_days = 7

  tags = {
    Project = "Documantic"
  }
}

resource "aws_cloudwatch_log_group" "cleanup" {
  name              = "/aws/lambda/${var.cleanup_lambda_name}"
  retention_in_days = 7

  tags = {
    Project = "Documantic"
  }
}

# ── Alarm: alert if processor Lambda fails (errors > 0 in 5 min window) ───────

resource "aws_cloudwatch_metric_alarm" "processor_errors" {
  alarm_name          = "${var.name_prefix}-processor-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Processor Lambda has encountered errors — AI pipeline may be failing silently"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.processor_lambda_name
  }

  tags = {
    Project = "Documantic"
  }
}

# ── Alarm: alert if processor Lambda duration exceeds 4 minutes ───────────────

resource "aws_cloudwatch_metric_alarm" "processor_duration" {
  alarm_name          = "${var.name_prefix}-processor-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Maximum"
  threshold           = 240000
  alarm_description   = "Processor Lambda is approaching its 5-minute timeout"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.processor_lambda_name
  }

  tags = {
    Project = "Documantic"
  }
}
