resource "aws_ecr_repository" "ecr_caption_generator" {
  name                 = "ecr-caption-generator"
  image_tag_mutability = "MUTABLE"
}