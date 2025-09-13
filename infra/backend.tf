terraform {
  backend "s3" {
    bucket  = "terraform-state-darlan"
    key     = "api/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
    use_lockfile = true
  }
}