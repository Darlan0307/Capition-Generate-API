resource "aws_instance" "api_server" {
  ami                    = "ami-0b09ffb6d8b58ca91"
  instance_type          = "t2.micro"
  key_name               = "chave-site"
  vpc_security_group_ids = [aws_security_group.website_sg.id]
  iam_instance_profile   = "ECR-EC2-Role"
  user_data = file("user_data.sh")

  tags = {
    Name        = "api-server"
    Provisioned = "Terraform"
    Cliente     = "Darlan"
  }
}

## Security Group
resource "aws_security_group" "website_sg" {
  name   = "website-sg"
  vpc_id = "vpc-08fc1f6851706e638"
  tags = {
    Name        = "website-sg"
    Provisioned = "Terraform"
    Cliente     = "Darlan"
  }
}

variable "my_ip" {
  description = "IP público para acesso via SSH"
  type        = string
}

# criando regras de entrada
resource "aws_vpc_security_group_ingress_rule" "allow_ssh" {
  security_group_id = aws_security_group.website_sg.id
  cidr_ipv4         = "${var.my_ip}/32"
  from_port         = 22
  ip_protocol       = "tcp"
  to_port           = 22
}

resource "aws_vpc_security_group_ingress_rule" "allow_http" {
  security_group_id = aws_security_group.website_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "allow_https" {
  security_group_id = aws_security_group.website_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}
resource "aws_vpc_security_group_egress_rule" "allow_all_outbound" {
  security_group_id = aws_security_group.website_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = -1
}