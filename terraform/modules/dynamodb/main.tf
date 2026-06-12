resource "aws_dynamodb_table" "jobs" {
  name         = "${var.name_prefix}-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"

  attribute {
    name = "jobId"
    type = "S"
  }

  # TTL on 'expiry' — DynamoDB auto-deletes items after 48 hrs
  ttl {
    attribute_name = "expiry"
    enabled        = true
  }

  tags = {
    Project = "Documantic"
  }
}

resource "aws_dynamodb_table" "users" {
  name         = "${var.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  tags = {
    Project = "Documantic"
  }
}
