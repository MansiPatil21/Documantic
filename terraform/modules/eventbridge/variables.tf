variable "name_prefix" {
  description = "Unique prefix for all resource names"
  type        = string
}

variable "cleanup_lambda_arn" {
  description = "ARN of the cleanup Lambda function"
  type        = string
}

variable "cleanup_lambda_name" {
  description = "Name of the cleanup Lambda function"
  type        = string
}
