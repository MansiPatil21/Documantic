terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "codedoc-${random_id.suffix.hex}"
}

data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

data "aws_iam_instance_profile" "lab_profile" {
  name = "LabInstanceProfile"
}

module "s3" {
  source      = "./modules/s3"
  name_prefix = local.name_prefix
}

module "dynamodb" {
  source      = "./modules/dynamodb"
  name_prefix = local.name_prefix
}

module "secrets_manager" {
  source       = "./modules/secrets_manager"
  name_prefix  = local.name_prefix
  groq_api_key = var.groq_api_key
}

module "sns" {
  source           = "./modules/sns"
  name_prefix      = local.name_prefix
  ses_sender_email = var.ses_sender_email
}

module "lambda" {
  source               = "./modules/lambda"
  name_prefix          = local.name_prefix
  lab_role_arn         = data.aws_iam_role.lab_role.arn
  storage_bucket_name  = module.s3.storage_bucket_name
  storage_bucket_arn   = module.s3.storage_bucket_arn
  dynamodb_table_name  = module.dynamodb.table_name
  groq_api_key         = var.groq_api_key
  ses_sender_email     = var.ses_sender_email
  groq_secret_name     = module.secrets_manager.secret_name
  sns_topic_arn        = module.sns.topic_arn
}

module "api_gateway" {
  source                = "./modules/api_gateway"
  name_prefix           = local.name_prefix
  api_lambda_arn        = module.lambda.api_lambda_arn
  api_lambda_invoke_arn = module.lambda.api_lambda_invoke_arn
}

module "ec2" {
  source                = "./modules/ec2"
  name_prefix           = local.name_prefix
  ami_id                = var.ami_id
  instance_type         = var.ec2_instance_type
  key_name              = var.key_name
  instance_profile_name = data.aws_iam_instance_profile.lab_profile.name
  storage_bucket_name   = module.s3.storage_bucket_name
  dynamodb_table_name   = module.dynamodb.table_name
  users_table_name      = module.dynamodb.users_table_name
  api_gateway_url       = module.api_gateway.api_url
}

module "cloudwatch" {
  source               = "./modules/cloudwatch"
  name_prefix          = local.name_prefix
  processor_lambda_name = module.lambda.processor_lambda_name
  api_lambda_name      = module.lambda.api_lambda_name
  cleanup_lambda_name  = module.lambda.cleanup_lambda_name
}

module "eventbridge" {
  source              = "./modules/eventbridge"
  name_prefix         = local.name_prefix
  cleanup_lambda_arn  = module.lambda.cleanup_lambda_arn
  cleanup_lambda_name = module.lambda.cleanup_lambda_name
}

# CloudFront is blocked in AWS Academy (cloudfront:CreateDistribution denied).
# SES email identity cannot be managed via Terraform in AWS Academy (ses:VerifyEmailIdentity is blocked).
# Verify mansican908@gmail.com manually: AWS Console → SES → Verified Identities → Create Identity.
