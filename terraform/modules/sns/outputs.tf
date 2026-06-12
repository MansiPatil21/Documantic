output "topic_arn" {
  value = aws_sns_topic.job_complete.arn
}

output "topic_name" {
  value = aws_sns_topic.job_complete.name
}
