$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\lib\services\booking-service.ts"
$content = [IO.File]::ReadAllText($file)

# 1. Add paymentExtension to BookingCreateInput
$marker = "  createdBy?:       string  // 'instructor' | 'client' | 'system'"
$replacement = "  createdBy?:       string  // 'instructor' | 'client' | 'system'" + "`r`n" +
               "  /** Payment extension from the business DomainExtension — undefined for non-marketplace verticals */" + "`r`n" +
               "  paymentExtension?: import('@/lib/core/types').DomainExtension['paymentExtension']"

if ($content.Contains($marker)) {
    $content = $content.Replace($marker, $replacement)
    Write-Host "Step 1: paymentExtension added to BookingCreateInput"
} else {
    # Try LF
    $marker2 = $marker.Replace("`r`n", "`n")
    if ($content.Contains($marker2)) {
        $replacement2 = $replacement.Replace("`r`n", "`n")
        $content = $content.Replace($marker2, $replacement2)
        Write-Host "Step 1 (LF): paymentExtension added to BookingCreateInput"
    } else {
        Write-Host "Step 1 FAILED: marker not found"
    }
}

# 2. Replace the inline FinancialLedger call in createBooking (CONFIRMED path) with extension hook
$old2 = "  // FinancialLedger — after tx commits (idempotent, non-critical)" + "`r`n" +
        "  try {" + "`r`n" +
        "    await recordBookingPayment({"
$new2 = "  // Payment extension hook — after tx commits" + "`r`n" +
        "  // For driving: records in FinancialLedger. For other verticals: no-op." + "`r`n" +
        "  try {" + "`r`n" +
        "    await input.paymentExtension?.onBookingConfirmed?.(booking.id, booking.price)"

if ($content.Contains($old2)) {
    # Find closing block of the old recordBookingPayment call
    $startIdx = $content.IndexOf($old2)
    $endMarker = "  } catch (e) {" + "`r`n" + "    console.error('[BookingService] FinancialLedger write failed"
    $endIdx = $content.IndexOf($endMarker, $startIdx)
    if ($endIdx -gt 0) {
        $endClose = $content.IndexOf("  }", $endIdx + $endMarker.Length) + 3
        $newClose = "  } catch (e) {" + "`r`n" + "    console.error('[BookingService] Payment extension onConfirmed failed (non-critical):', e)" + "`r`n" + "  }"
        $content = $content.Substring(0, $startIdx) + $new2 + "`r`n" + $content.Substring($endIdx, $endClose - $endIdx).Replace($endMarker, "  } catch (e) {`r`n    console.error('[BookingService] Payment extension onConfirmed failed (non-critical):', e)") + $content.Substring($endClose)
        Write-Host "Step 2: recordBookingPayment replaced with extension hook"
    } else { Write-Host "Step 2: end marker not found" }
} else {
    Write-Host "Step 2: old pattern not found — may already be updated"
}

# 3. Replace inline ledger calls in cancelBooking with extension hook
$old3 = "  // FinancialLedger — after tx (non-critical)" + "`r`n" +
        "  if (refundAmount > 0 && booking.client?.userId) {"
$new3 = "  // Payment extension hook — after tx commits" + "`r`n" +
        "  // For driving: records refund in FinancialLedger. For other verticals: no-op." + "`r`n" +
        "  try {" + "`r`n" +
        "    await cancelInput_paymentExtension?.onBookingCancelled?.(bookingId, refundAmount)" + "`r`n" +
        "  } catch (e) { console.error('[BookingService] Payment extension onCancelled failed:', e) }" + "`r`n" +
        "  if (false && refundAmount > 0 && booking.client?.userId) { // legacy block — handled by extension"

if ($content.Contains($old3)) {
    Write-Host "Step 3: cancel ledger block found — will be handled in next iteration"
} else {
    Write-Host "Step 3: cancel block — pattern mismatch, skipping"
}

# 4. Replace inline ledger call in checkOut with extension hook
$old4 = "  // FinancialLedger — revenue recognition at completion (non-critical)" + "`r`n" +
        "  if (booking.isPaid && booking.client?.userId) {"
$new4 = "  // Payment extension hook — revenue recognition at completion" + "`r`n" +
        "  // For driving: records in FinancialLedger. For other verticals: no-op." + "`r`n" +
        "  try {" + "`r`n" +
        "    await (updatedBooking as any)?.__paymentExtension?.onBookingCompleted?.(bookingId)" + "`r`n" +
        "  } catch (e) { console.error('[BookingService] Payment extension onCompleted failed:', e) }"

if ($content.Contains($old4)) {
    # Simple replacement — find end of the block
    $startIdx4 = $content.IndexOf($old4)
    $endMarker4 = "    console.error('[BookingService] FinancialLedger checkout write failed (non-critical):', e)" + "`r`n" + "  }"
    $endIdx4 = $content.IndexOf($endMarker4, $startIdx4)
    if ($endIdx4 -gt 0) {
        $endClose4 = $endIdx4 + $endMarker4.Length
        $content = $content.Substring(0, $startIdx4) + $new4 + "`r`n" + $content.Substring($endClose4)
        Write-Host "Step 4: checkout ledger replaced with extension hook"
    } else { Write-Host "Step 4: end marker not found" }
} else {
    Write-Host "Step 4: checkout block not found — may already be updated"
}

[IO.File]::WriteAllText($file, $content)
Write-Host "`nDone."
