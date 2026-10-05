data "aws_iam_policy_document" "pool_warm_pool" {
  count = var.config.warm_pool.enabled ? 1 : 0

  statement {
    sid = "WarmPoolDescribe"
    actions = [
      "ec2:DescribeInstances",
      "ec2:DescribeLaunchTemplateVersions",
      "ec2:DescribeSpotInstanceRequests",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "WarmPoolDestroy"
    actions   = ["ec2:CancelSpotInstanceRequests", "ec2:TerminateInstances"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "ec2:ResourceTag/ghr:Application"
      values   = ["github-action-runner"]
    }
  }

  statement {
    sid       = "WarmPoolIndex"
    actions   = ["dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:UpdateItem"]
    resources = [var.config.warm_pool_index_table.arn]
  }

  statement {
    sid       = "WarmPoolReadAmiParameter"
    actions   = ["ssm:GetParameter"]
    resources = [var.config.ami_id_ssm_parameter_arn]
  }

  # Launching or starting instances with the caller's credentials needs the EBS encryption key (e.g. a customer-managed default key).
  statement {
    sid = "WarmPoolEbsEncryption"
    actions = [
      "kms:CreateGrant",
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:GenerateDataKeyWithoutPlaintext",
      "kms:ReEncryptFrom",
      "kms:ReEncryptTo",
    ]
    resources = ["*"]

    condition {
      test     = "StringLike"
      variable = "kms:ViaService"
      values   = ["ec2.*.amazonaws.com", "ec2.*.amazonaws.com.cn"]
    }
  }
}

resource "aws_iam_role_policy" "pool_warm_pool" {
  count = var.config.warm_pool.enabled ? 1 : 0

  name   = "warm-pool-policy"
  role   = aws_iam_role.pool.name
  policy = data.aws_iam_policy_document.pool_warm_pool[0].json
}

# Primed instances stop themselves; mark them warm without waiting for the next schedule.
resource "aws_cloudwatch_event_rule" "instance_stopped" {
  count = var.config.warm_pool.enabled ? 1 : 0

  name_prefix = local.pool_name_prefix
  description = "Marks primed warm pool instances available as soon as they stop."
  event_pattern = jsonencode({
    source        = ["aws.ec2"]
    "detail-type" = ["EC2 Instance State-change Notification"]
    detail        = { state = ["stopped"] }
  })
  tags = var.config.tags
}

resource "aws_cloudwatch_event_target" "instance_stopped" {
  count = var.config.warm_pool.enabled ? 1 : 0

  rule = aws_cloudwatch_event_rule.instance_stopped[0].name
  arn  = aws_lambda_function.pool.arn
}

resource "aws_lambda_permission" "instance_stopped" {
  count = var.config.warm_pool.enabled ? 1 : 0

  statement_id  = "AllowInstanceStoppedEvents"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pool.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.instance_stopped[0].arn
}
