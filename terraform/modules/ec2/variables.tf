variable "name_prefix" {
  description = "Unique prefix for all resource names"
  type        = string
}

variable "ami_id" {
  description = "AMI ID (Ubuntu 24.04 LTS)"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
}

variable "key_name" {
  description = "EC2 key pair name"
  type        = string
}

variable "instance_profile_name" {
  description = "IAM instance profile name (LabInstanceProfile)"
  type        = string
}

variable "storage_bucket_name" {
  description = "S3 storage bucket name — written to .env on the instance"
  type        = string
}

variable "dynamodb_table_name" {
  description = "DynamoDB table name — written to .env on the instance"
  type        = string
}

variable "api_gateway_url" {
  description = "API Gateway URL — written to .env on the instance"
  type        = string
}

variable "users_table_name" {
  description = "DynamoDB users table name — written to .env on the instance"
  type        = string
}
