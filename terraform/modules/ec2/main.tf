resource "aws_security_group" "backend" {
  name        = "${var.name_prefix}-backend-sg"
  description = "Allow SSH, HTTP, and FastAPI traffic"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "FastAPI backend"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project = "Documantic"
    Name    = "${var.name_prefix}-backend-sg"
  }
}

resource "aws_instance" "backend" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  iam_instance_profile        = var.instance_profile_name
  vpc_security_group_ids      = [aws_security_group.backend.id]
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/user_data.sh", {
    storage_bucket_name = var.storage_bucket_name
    dynamodb_table_name = var.dynamodb_table_name
    users_table_name    = var.users_table_name
    api_gateway_url     = var.api_gateway_url
  })

  tags = {
    Name    = "${var.name_prefix}-backend"
    Project = "Documantic"
  }
}
