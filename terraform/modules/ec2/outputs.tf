output "public_ip" {
  description = "Public IP of the EC2 backend instance"
  value       = aws_instance.backend.public_ip
}

output "instance_id" {
  value = aws_instance.backend.id
}

output "security_group_id" {
  value = aws_security_group.backend.id
}
