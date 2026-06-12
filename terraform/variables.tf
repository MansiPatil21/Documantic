variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "ami_id" {
  description = "AMI ID for EC2 instance (Ubuntu 24.04 LTS)"
  type        = string
  default     = "ami-0a0e5d9c7acc336f1"
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.micro"
}

variable "key_name" {
  description = "EC2 key pair name"
  type        = string
  default     = "vockey"
}

variable "groq_api_key" {
  description = "Groq API key for LLaMA-3 AI processing"
  type        = string
  sensitive   = true
}

variable "ses_sender_email" {
  description = "Verified SES sender email address"
  type        = string
  default     = "mansican908@gmail.com"
}
