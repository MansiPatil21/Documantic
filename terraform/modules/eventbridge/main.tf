# ── EventBridge rule: runs cleanup Lambda every 24 hours ──────────────────────

resource "aws_cloudwatch_event_rule" "cleanup_schedule" {
  name                = "${var.name_prefix}-cleanup-schedule"
  description         = "Trigger Documantic cleanup Lambda every 24 hours to delete expired jobs"
  schedule_expression = "rate(24 hours)"

  tags = {
    Project = "Documantic"
  }
}

resource "aws_cloudwatch_event_target" "cleanup_lambda" {
  rule      = aws_cloudwatch_event_rule.cleanup_schedule.name
  target_id = "CleanupLambdaTarget"
  arn       = var.cleanup_lambda_arn
}

# Allow EventBridge to invoke the cleanup Lambda
resource "aws_lambda_permission" "eventbridge_invoke_cleanup" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.cleanup_lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cleanup_schedule.arn
}
