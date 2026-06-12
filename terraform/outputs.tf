output "frontend_url" {
  description = "S3 static website URL for the React frontend"
  value       = "http://${module.s3.frontend_website_endpoint}"
}

output "api_gateway_url" {
  description = "API Gateway invoke URL"
  value       = module.api_gateway.api_url
}

output "ec2_public_ip" {
  description = "EC2 instance public IP address"
  value       = module.ec2.public_ip
}

output "ec2_backend_url" {
  description = "FastAPI backend base URL"
  value       = "http://${module.ec2.public_ip}:8000"
}

output "storage_bucket_name" {
  description = "S3 bucket for uploaded zips and generated output"
  value       = module.s3.storage_bucket_name
}

output "frontend_bucket_name" {
  description = "S3 bucket hosting the React frontend"
  value       = module.s3.frontend_bucket_name
}

output "dynamodb_table_name" {
  description = "DynamoDB table tracking documentation jobs"
  value       = module.dynamodb.table_name
}

output "sns_topic_arn" {
  description = "SNS topic ARN for job completion notifications"
  value       = module.sns.topic_arn
}

output "secrets_manager_name" {
  description = "Secrets Manager secret name for Groq API key"
  value       = module.secrets_manager.secret_name
}
