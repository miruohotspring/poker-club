output "nextauth_table_name" {
  value = aws_dynamodb_table.next_auth.name
}

output "dynamodb_access_role_arn" {
  value = aws_iam_role.nextauth_dynamodb_role.arn
}

output "nextauth_aws_access_key_id" {
  description = "Access key ID for NextAuth DynamoDB user"
  value       = aws_iam_access_key.nextauth_dynamodb_user_key.id
  sensitive   = true
}

output "nextauth_aws_secret_access_key" {
  description = "Secret access key for NextAuth DynamoDB user"
  value       = aws_iam_access_key.nextauth_dynamodb_user_key.secret
  sensitive   = true
}
