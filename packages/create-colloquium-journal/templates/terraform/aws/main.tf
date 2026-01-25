terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "colloquium"
      Environment = var.environment
      ManagedBy   = "terraform"
      JournalName = var.journal_name
    }
  }
}

locals {
  name_prefix = "${var.journal_slug}-${var.environment}"

  common_tags = {
    Project     = "colloquium"
    Environment = var.environment
    JournalName = var.journal_name
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "magic_link_secret" {
  length  = 64
  special = false
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
