$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\lib\services\booking-service.ts"
$lines = [IO.File]::ReadAllLines($file)
$result = New-Object System.Collections.Generic.List[string]
$i = 0
$changed = 0

while ($i -lt $lines.Length) {
    $line = $lines[$i]

    # Fix 1: Add paymentExtension to BookingCreateInput after createdBy line
    if ($line -match "createdBy\?:\s+string\s+//\s+'instructor'") {
        $result.Add($line)
        $result.Add("  /** Payment extension — undefined for non-marketplace verticals (plumber, tax, beauty) */")
        $result.Add("  paymentExtension?: import('@/lib/core/types').DomainExtension['paymentExtension']")
        $i++; $changed++
        continue
    }

    # Fix 2: Replace the inline recordBookingPayment block in createBooking
    # Detect start: "  // FinancialLedger — after tx commits (idempotent, non-critical)"
    if ($line.TrimEnd() -eq "  // FinancialLedger — after tx commits (idempotent, non-critical)") {
        # Skip lines until we hit the closing "  }" of the try/catch block
        $result.Add("  // Payment extension hook — fires after tx commits (non-critical, non-blocking)")
        $result.Add("  // For driving: records in FinancialLedger. For other verticals: no-op.")
        $result.Add("  try {")
        $result.Add("    await input.paymentExtension?.onBookingConfirmed?.(booking.id, booking.price)")
        $result.Add("  } catch (e) {")
        $result.Add("    console.error('[BookingService] paymentExtension.onBookingConfirmed failed (non-critical):', e)")
        $result.Add("  }")
        # Skip the old block until we find the closing "  }" after the catch
        $depth = 0
        $started = $false
        $i++
        while ($i -lt $lines.Length) {
            $l = $lines[$i]
            if ($l.Contains("{")) { $depth++; $started = $true }
            if ($l.Contains("}")) { $depth-- }
            if ($started -and $depth -le 0) { $i++; break }
            $i++
        }
        $changed++
        continue
    }

    # Fix 3: Replace the inline ledger block in cancelBooking
    # Detect: "  // FinancialLedger — after tx (non-critical)"
    if ($line.TrimEnd() -eq "  // FinancialLedger — after tx (non-critical)") {
        $result.Add("  // Payment extension hook — refund recording (non-critical)")
        $result.Add("  // For driving: records refund in FinancialLedger. For other verticals: no-op.")
        $result.Add("  try {")
        $result.Add("    await (input as any)?.paymentExtension?.onBookingCancelled?.(bookingId, refundAmount)")
        $result.Add("  } catch (e) {")
        $result.Add("    console.error('[BookingService] paymentExtension.onBookingCancelled failed (non-critical):', e)")
        $result.Add("  }")
        # Skip old block
        $depth = 0; $started = $false; $i++
        while ($i -lt $lines.Length) {
            $l = $lines[$i]
            if ($l.Contains("{")) { $depth++; $started = $true }
            if ($l.Contains("}")) { $depth-- }
            if ($started -and $depth -le 0) { $i++; break }
            $i++
        }
        $changed++
        continue
    }

    # Fix 4: Replace inline ledger in checkOut
    # Detect: "  // FinancialLedger — revenue recognition at completion (non-critical)"
    if ($line.TrimEnd() -eq "  // FinancialLedger — revenue recognition at completion (non-critical)") {
        $result.Add("  // Payment extension hook — revenue recognition at completion (non-critical)")
        $result.Add("  // For driving: records in FinancialLedger. For other verticals: no-op.")
        $result.Add("  try {")
        $result.Add("    await (checkOutExtension as any)?.onBookingCompleted?.(bookingId)")
        $result.Add("  } catch (e) {")
        $result.Add("    console.error('[BookingService] paymentExtension.onBookingCompleted failed (non-critical):', e)")
        $result.Add("  }")
        # Skip old block
        $depth = 0; $started = $false; $i++
        while ($i -lt $lines.Length) {
            $l = $lines[$i]
            if ($l.Contains("{")) { $depth++; $started = $true }
            if ($l.Contains("}")) { $depth-- }
            if ($started -and $depth -le 0) { $i++; break }
            $i++
        }
        $changed++
        continue
    }

    $result.Add($line)
    $i++
}

[IO.File]::WriteAllLines($file, $result.ToArray())
Write-Host "Done. $changed replacements made."
