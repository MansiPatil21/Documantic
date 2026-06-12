variable "name_prefix" {
  description = "Unique prefix for all resource names"
  type        = string
}

variable "lab_role_arn" {
  description = "ARN of the AWS Academy LabRole used as Lambda execution role"
  type        = string
}

variable "storage_bucket_name" {
  description = "Name of the S3 storage bucket"
  type        = string
}

variable "storage_bucket_arn" {
  description = "ARN of the S3 storage bucket"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB jobs table"
  type        = string
}

variable "groq_api_key" {
  description = "Groq API key injected into processor Lambda environment"
  type        = string
  sensitive   = true
}

variable "ses_sender_email" {
  description = "SES verified sender email address"
  type        = string
}

variable "groq_secret_name" {
  description = "Secrets Manager secret name for Groq API key"
  type        = string
  default     = ""
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for job completion notifications"
  type        = string
  default     = ""
}
