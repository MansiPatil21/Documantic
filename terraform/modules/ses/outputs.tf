output "sender_email" {
  value = aws_ses_email_identity.sender.email
}

output "identity_arn" {
  value = aws_ses_email_identity.sender.arn
}
