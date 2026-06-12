variable "name_prefix" {
  type = string
}

variable "frontend_bucket_regional_domain" {
  description = "S3 bucket regional domain name for CloudFront origin"
  type        = string
}
