output "api_url" {
  description = "API Gateway invoke URL (base URL for all routes)"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "api_id" {
  value = aws_apigatewayv2_api.codedoc.id
}
