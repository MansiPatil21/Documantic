variable "name_prefix" {
  description = "Unique prefix for all resource names"
  type        = string
}

variable "processor_lambda_name" {
  description = "Name of the processor Lambda function"
  type        = string
}

variable "api_lambda_name" {
  description = "Name of the API Lambda function"
  type        = string
}

variable "cleanup_lambda_name" {
  description = "Name of the cleanup Lambda function"
  type        = string
}
