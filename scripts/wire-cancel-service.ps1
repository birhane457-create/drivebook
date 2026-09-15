$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\app\api\bookings\[id]\cancel\route.ts"
$content = [IO.File]::ReadAllText($file)

# Find the start marker — the refund calculation comment block
$startMarker = '    // Refund calculation'
$startIdx = $content.IndexOf($startMarker)
if ($startIdx -lt 0) { Write-Host "ERROR: start marker not found"; exit 1 }

# Find the end marker — just after the old transaction try/catch block ends
# The block ends with '    throw err' + newlines + '    }'
$endMarker = "      throw err`r`n    }`r`n`r`n    // Create admin approval task"
$endIdx = $content.IndexOf($endMarker)
if ($endIdx -lt 0) {
    # Try unix line endings
    $endMarker = "      throw err`n    }`n`n    // Create admin approval task"
    $endIdx = $content.IndexOf($endMarker)
}
if ($endIdx -lt 0) { Write-Host "ERROR: end marker not found"; exit 1 }

# The replacement block replaces everything from startMarker up to (but not including) '// Create admin approval task'
$endReplaceIdx = $endIdx + $endMarker.Length - "    // Create admin approval task".Length

$replacement = @'
    const now = new Date()
    const actorRole = isAdmin ? 'ADMIN' : isInstructor ? 'INSTRUCTOR' : 'CLIENT'

    // Delegate all business logic (refund calc, wallet, ledger, audit) to BookingService
    let cancelResult: Awaited<ReturnType<typeof cancelBooking>>
    try {
      cancelResult = await cancelBooking(params.id, user.id, actorRole as any, reason)
    } catch (err: any) {
      if (err?.code === 'ALREADY_CANCELLED') {
        return NextResponse.json({ error: 'Booking has already been cancelled' }, { status: 400 })
      }
      throw err
    }

    const { refundAmount, refundPercentage, hoursNotice: hoursUntilBooking } = cancelResult
    const updated = cancelResult.booking
    const isPastBooking = hoursUntilBooking < 0
    const isNonRefundable = (booking as any).isNonRefundable === true

    // Create admin approval task for refunds > 24h (post-payout scenario)
'@

$newContent = $content.Substring(0, $startIdx) + $replacement + $content.Substring($endReplaceIdx)
[IO.File]::WriteAllText($file, $newContent)
Write-Host "Done. Lines replaced."
