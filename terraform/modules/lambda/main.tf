# ── Package Lambda source code into zip archives ──────────────────────────────

data "archive_file" "processor" {
  type        = "zip"
  source_dir  = "${path.root}/../lambda/processor"
  output_path = "${path.module}/processor.zip"
}

data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.root}/../lambda/api"
  output_path = "${path.module}/api.zip"
}

data "archive_file" "cleanup" {
  type        = "zip"
  source_dir  = "${path.root}/../lambda/cleanup"
  output_path = "${path.module}/cleanup.zip"
}

# ── Processor Lambda: S3-triggered AI documentation pipeline ──────────────────

resource "aws_lambda_function" "processor" {
  filename         = data.archive_file.processor.output_path
  function_name    = "${var.name_prefix}-processor"
  role             = var.lab_role_arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  timeout          = 300
  memory_size      = 512
  source_code_hash = data.archive_file.processor.output_base64sha256

  environment {
    variables = {
      STORAGE_BUCKET   = var.storage_bucket_name
      DYNAMODB_TABLE   = var.dynamodb_table_name
      GROQ_API_KEY     = var.groq_api_key
      GROQ_SECRET_NAME = var.groq_secret_name
      SNS_TOPIC_ARN    = var.sns_topic_arn
      SES_SENDER_EMAIL = var.ses_sender_email
      AWS_REGION_NAME  = "us-east-1"
    }
  }

  tags = {
    Project = "Documantic"
  }
}

# Allow S3 to invoke the processor Lambda
resource "aws_lambda_permission" "s3_invoke_processor" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.storage_bucket_arn
}

# S3 event notification: any .zip uploaded to uploads/ triggers processor
resource "aws_s3_bucket_notification" "upload_trigger" {
  bucket = var.storage_bucket_name

  lambda_function {
    lambda_function_arn = aws_lambda_function.processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ".zip"
  }

  depends_on = [aws_lambda_permission.s3_invoke_processor]
}

# ── API Lambda: handles job status + presigned download URL requests ───────────

resource "aws_lambda_function" "api" {
  filename         = data.archive_file.api.output_path
  function_name    = "${var.name_prefix}-api"
  role             = var.lab_role_arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256
  source_code_hash = data.archive_file.api.output_base64sha256

  environment {
    variables = {
      STORAGE_BUCKET  = var.storage_bucket_name
      DYNAMODB_TABLE  = var.dynamodb_table_name
      AWS_REGION_NAME = "us-east-1"
    }
  }

  tags = {
    Project = "Documantic"
  }
}

# ── Cleanup Lambda: EventBridge-triggered 48hr expiry cleanup ─────────────────

resource "aws_lambda_function" "cleanup" {
  filename         = data.archive_file.cleanup.output_path
  function_name    = "${var.name_prefix}-cleanup"
  role             = var.lab_role_arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  timeout          = 60
  memory_size      = 128
  source_code_hash = data.archive_file.cleanup.output_base64sha256

  environment {
    variables = {
      STORAGE_BUCKET  = var.storage_bucket_name
      DYNAMODB_TABLE  = var.dynamodb_table_name
      AWS_REGION_NAME = "us-east-1"
    }
  }

  tags = {
    Project = "Documantic"
  }
}
