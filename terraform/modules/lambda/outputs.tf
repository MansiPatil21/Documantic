output "processor_lambda_name" {
  value = aws_lambda_function.processor.function_name
}

output "processor_lambda_arn" {
  value = aws_lambda_function.processor.arn
}

output "api_lambda_name" {
  value = aws_lambda_function.api.function_name
}

output "api_lambda_arn" {
  value = aws_lambda_function.api.arn
}

output "api_lambda_invoke_arn" {
  value = aws_lambda_function.api.invoke_arn
}

output "cleanup_lambda_name" {
  value = aws_lambda_function.cleanup.function_name
}

output "cleanup_lambda_arn" {
  value = aws_lambda_function.cleanup.arn
}
