variable "name_prefix" {
  description = "Unique prefix for all resource names"
  type        = string
}

variable "api_lambda_arn" {
  description = "ARN of the API Lambda function"
  type        = string
}

variable "api_lambda_invoke_arn" {
  description = "Invoke ARN of the API Lambda function"
  type        = string
}
