resource "aws_instance" "api_server" {
  ami                    = "ami-0b09ffb6d8b58ca91" #Amazon Linux 2 AMI
  instance_type          = "t2.micro"
  key_name               = "chave-site" # criado manualmente
  vpc_security_group_ids = [aws_security_group.website_sg.id]
  iam_instance_profile   = "ECR-EC2-Role" # criado manualmente

  tags = {
    Name        = "api-server"
    Provisioned = "Terraform" # para não poder alterar de forma manual
    Cliente     = "Darlan"
  }
}

## Security Group
resource "aws_security_group" "website_sg" {
  name   = "website-sg"
  vpc_id = "vpc-08fc1f6851706e638" # vpc padrão
  tags = {
    Name        = "website-sg"
    Provisioned = "Terraform"
    Cliente     = "Darlan"
  }
}

# criando regras de entrada
resource "aws_vpc_security_group_ingress_rule" "allow_ssh" {
  security_group_id = aws_security_group.website_sg.id
  cidr_ipv4         = "170.80.49.176/32"
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

# regra de saida para a instância conseguir acessar a internet 
# para conseguir instalar o docker e rodar a aplicação
resource "aws_vpc_security_group_egress_rule" "allow_all_outbound" {
  security_group_id = aws_security_group.website_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = -1 # todos os protocolos e portas
}