# F-09 Transaction Safety Analysis
# Inspects all 11 transaction blocks for external side effects

$file = "app\api\stripe\webhook\route.ts"
$content = Get-Content $file -Raw -Encoding UTF8
$lines = $content -split "`n"

$transactionStarts = @(448, 562, 679, 876, 1317, 1427, 1571, 1608, 1656, 1701, 2237)
$dangerousPatterns = @(
    @{ Name="Stripe API"; Pattern="stripe\.(charges|refunds|customers|subscriptions|paymentIntents|checkout|webhooks)\.(create|update|cancel|retrieve)" },
    @{ Name="Email"; Pattern="(emailService|sendEmail|sendSingleLessonReceipt|sendPackagePurchaseReceipt|sendWalletTopUpReceipt|sendBookingConfirmation)" },
    @{ Name="SMS"; Pattern="(smsService|sendSMS|twilioClient)" },
    @{ Name="HTTP Call"; Pattern="(fetch\(|axios\.|http\.)" },
    @{ Name="Notification"; Pattern="(notifyPaymentReceived|sendNotification|pushNotification)" },
    @{ Name="Queue/Event"; Pattern="(publishEvent|enqueue|sendToQueue)" },
    @{ Name="Alert"; Pattern="sendAlert\(" },
    @{ Name="Audit Log External"; Pattern="logSubscriptionAction|logFinancialAction" }
)

Write-Output "================================================================"
Write-Output "F-09 TRANSACTION SAFETY ANALYSIS"
Write-Output "================================================================"
Write-Output ""

$results = @()

for ($i = 0; $i -lt $transactionStarts.Count; $i++) {
    $start = $transactionStarts[$i] - 1  # Convert to 0-indexed
    
    # Find transaction end (closing brace with SERIALIZABLE_TX)
    $end = $start
    $braceCount = 0
    $foundStart = $false
    
    for ($j = $start; $j -lt $lines.Count; $j++) {
        $line = $lines[$j]
        
        if ($line -match '\$transaction\s*\(') {
            $foundStart = $true
        }
        
        if ($foundStart) {
            # Count braces
            $openBraces = ($line.ToCharArray() | Where-Object { $_ -eq '{' }).Count
            $closeBraces = ($line.ToCharArray() | Where-Object { $_ -eq '}' }).Count
            $braceCount += $openBraces - $closeBraces
            
            if ($line -match 'SERIALIZABLE_TX\)') {
                $end = $j
                break
            }
            
            # Safety limit
            if ($j - $start -gt 500) {
                $end = $j
                break
            }
        }
    }
    
    # Extract transaction block
    $blockLines = $lines[$start..$end]
    $block = $blockLines -join "`n"
    
    # Find context (what event/handler is this?)
    $context = "Unknown"
    for ($k = $start - 1; $k -ge [Math]::Max(0, $start - 30); $k--) {
        if ($lines[$k] -match "// Handle (.+)" -or 
            $lines[$k] -match "case '(.+)':" -or
            $lines[$k] -match "async function (\w+)" -or
            $lines[$k] -match "if.*event\.type === '(.+)'") {
            $context = $matches[1]
            break
        }
    }
    
    Write-Output "Transaction #$($i + 1) - Line $($transactionStarts[$i])"
    Write-Output "Context: $context"
    Write-Output "Lines: $($transactionStarts[$i]) - $($end + 1)"
    Write-Output ""
    
    # Check for dangerous patterns
    $found = @()
    foreach ($pattern in $dangerousPatterns) {
        if ($block -match $pattern.Pattern) {
            $found += $pattern.Name
        }
    }
    
    if ($found.Count -gt 0) {
        Write-Output "âš  EXTERNAL SIDE EFFECTS FOUND:"
        $found | ForEach-Object { Write-Output "   - $_" }
        Write-Output ""
        
        # Show specific lines with side effects
        Write-Output "Affected lines:"
        for ($line = 0; $line -lt $blockLines.Count; $line++) {
            foreach ($pattern in $dangerousPatterns) {
                if ($blockLines[$line] -match $pattern.Pattern) {
                    $actualLine = $start + $line + 1
                    Write-Output "   Line $actualLine : $($blockLines[$line].Trim())"
                }
            }
        }
    } else {
        Write-Output "âœ" SAFE - No external side effects detected"
    }
    
    Write-Output ""
    Write-Output "----------------------------------------------------------------"
    Write-Output ""
    
    $results += @{
        Number = $i + 1
        Line = $transactionStarts[$i]
        Context = $context
        Safe = $found.Count -eq 0
        SideEffects = $found
    }
}

Write-Output ""
Write-Output "================================================================"
Write-Output "SUMMARY"
Write-Output "================================================================"
Write-Output ""
Write-Output "Total transactions: $($results.Count)"
Write-Output "Safe transactions: $(($results | Where-Object { $_.Safe }).Count)"
Write-Output "Unsafe transactions: $(($results | Where-Object { -not $_.Safe }).Count)"
Write-Output ""

$unsafe = $results | Where-Object { -not $_.Safe }
if ($unsafe.Count -gt 0) {
    Write-Output "TRANSACTIONS REQUIRING REFACTORING:"
    $unsafe | ForEach-Object {
        Write-Output "   #$($_.Number) (Line $($_.Line)) - $($_.Context)"
        Write-Output "      Side effects: $($_.SideEffects -join ', ')"
    }
}

# Export results
$results | ConvertTo-Json -Depth 5 | Out-File "transaction-analysis-results.json" -Encoding UTF8
Write-Output ""
Write-Output "Results exported to: transaction-analysis-results.json"
