output "rule_arn" {
  value = aws_cloudwatch_event_rule.cleanup_schedule.arn
}
