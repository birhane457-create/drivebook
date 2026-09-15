# Refactor audit log calls out of transactions
$file = "app\api\stripe\webhook\route.ts"
$content = Get-Content $file -Raw -Encoding UTF8

Write-Output "Refactoring audit logs in 3 transactions..."

# Transaction 1: Line 562 - checkout.session.completed
# Move logSubscriptionAction after transaction
$pattern1 = '(?s)(await tx\.subscription\.updateMany\(\s*\{\s*where: \{ providerId \},\s*data: \{ stripeCustomerId: customer as string \}\s*\}\);)\s*\}\s*// Audit log\s*(await logSubscriptionAction\(\{[^}]+\}\);)\s*\}, SERIALIZABLE_TX\);'

$replacement1 = '$1
    }
  }, SERIALIZABLE_TX);

  // Audit log (outside transaction - non-fatal, best-effort)
  try {
    const tier = metadata?.tier;
    $2
  } catch (auditErr) {
    logger.error(''Failed to log audit event (non-fatal)'', { error: auditErr });
  }'

if ($content -match $pattern1) {
    $content = $content -replace $pattern1, $replacement1
    Write-Output "✓ Refactored transaction #1 (line 562)"
} else {
    Write-Output "✗ Could not find pattern for transaction #1"
}

# Save
Set-Content $file -Value $content -Encoding UTF8 -NoNewline
Write-Output "Refactoring complete"
