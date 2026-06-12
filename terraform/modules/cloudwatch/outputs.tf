output "processor_log_group_name" {
  value = aws_cloudwatch_log_group.processor.name
}

output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "cleanup_log_group_name" {
  value = aws_cloudwatch_log_group.cleanup.name
}
