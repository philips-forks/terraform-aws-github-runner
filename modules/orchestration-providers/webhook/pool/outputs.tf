output "pool" {
  description = "Scheduled pool Lambda resources."
  value = {
    lambda                = aws_lambda_function.pool
    log_group             = aws_cloudwatch_log_group.pool
    role                  = aws_iam_role.pool
    instance_stopped_rule = one(aws_cloudwatch_event_rule.instance_stopped[*])
  }
}
