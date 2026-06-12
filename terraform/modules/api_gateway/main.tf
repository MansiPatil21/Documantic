resource "aws_apigatewayv2_api" "codedoc" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "Documantic job status and download API"

  cors_configuration {
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 300
  }

  tags = {
    Project = "Documantic"
  }
}

resource "aws_apigatewayv2_integration" "api_lambda" {
  api_id                 = aws_apigatewayv2_api.codedoc.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.api_lambda_invoke_arn
  payload_format_version = "2.0"
}

# GET /jobs/{jobId} — returns job status from DynamoDB
resource "aws_apigatewayv2_route" "get_job" {
  api_id    = aws_apigatewayv2_api.codedoc.id
  route_key = "GET /jobs/{jobId}"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
}

# GET /jobs/{jobId}/download — returns presigned S3 URL for output zip
resource "aws_apigatewayv2_route" "get_download" {
  api_id    = aws_apigatewayv2_api.codedoc.id
  route_key = "GET /jobs/{jobId}/download"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.codedoc.id
  name        = "$default"
  auto_deploy = true
}

# Allow API Gateway to invoke the api Lambda
resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.api_lambda_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.codedoc.execution_arn}/*/*"
}
