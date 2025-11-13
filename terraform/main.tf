terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
  backend "local" {
    path = "./terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      terraform   = "true"
      project     = "poker-club"
      Environment = var.environment
    }
  }
}

# next-auth table
resource "aws_dynamodb_table" "next_auth" {
  name         = "poker-club-next-auth"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "pk"
  range_key = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expires"
    enabled        = true
  }
}

# IAM role for dynamodb access
resource "aws_iam_role" "nextauth_dynamodb_role" {
  name = "poker_club_dynamodb_role"
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [{
      "Effect" : "Allow",
      "Principal" : {
        # Amplify Hostingは内部的にLambda関数を利用してNext.jsのサーバーサイドコードを動かす(らしい)
        "Service" : "lambda.amazonaws.com"
      },
      "Action" : "sts:AssumeRole"
    }]
  })
}

# IAM policy for dynamodb access
resource "aws_iam_policy" "nextauth_dynamodb_policy" {
  name        = "poker_club_dynamodb_policy"
  description = "Policy for accessing nextauth DynamoDB tables"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Sid"   : "DynamoDBAccess",
        "Effect": "Allow",
        "Action": [
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:Describe*",
          "dynamodb:List*",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ],
        "Resource": [
          aws_dynamodb_table.next_auth.arn,
          "${aws_dynamodb_table.next_auth.arn}/index/GSI1"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "nextauth_dynamodb_role_attach" {
  role       = aws_iam_role.nextauth_dynamodb_role.name
  policy_arn = aws_iam_policy.nextauth_dynamodb_policy.arn
}

resource "aws_iam_user" "nextauth_dynamodb_user" {
  name = "poker_club_nextauth_user"
}

resource "aws_iam_user_policy_attachment" "nextauth_dynamodb_user_attach" {
  user       = aws_iam_user.nextauth_dynamodb_user.name
  policy_arn = aws_iam_policy.nextauth_dynamodb_policy.arn
}

resource "aws_iam_access_key" "nextauth_dynamodb_user_key" {
  user = aws_iam_user.nextauth_dynamodb_user.name
}
