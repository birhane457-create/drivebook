$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\app\api\client\bookings\[id]\reschedule\route.ts"
$content = [IO.File]::ReadAllText($file)

# Replace the old transaction opening (missing slot conflict check + findMany balance)
# with the new version that adds slot conflict + uses aggregate for balance

$old = 'updatedBooking = await prisma.$transaction(async (tx) => {' + "`r`n" +
       '        // Wallet adjustment for price change (if any)' + "`r`n" +
       '        if (priceDifference > 0) {' + "`r`n" +
       '          // Re-check balance inside transaction to prevent TOCTOU race' + "`r`n" +
       '          const txns = await tx.walletTransaction.findMany({' + "`r`n" +
       '            where: { walletId: wallet.id, status: ''CONFIRMED'' },' + "`r`n" +
       '          });' + "`r`n" +
       '          const txBalance = txns.reduce(' + "`r`n" +
       '            (sum: number, t: any) => (t.type === ''CREDIT'' ? sum + t.amount : sum - t.amount),' + "`r`n" +
       '            0' + "`r`n" +
       '          );'

$new = 'updatedBooking = await prisma.$transaction(async (tx) => {' + "`r`n" +
       '        // Slot conflict check (TOCTOU-safe) — was missing from client reschedule' + "`r`n" +
       '        if (newStartTime && newEndTime) {' + "`r`n" +
       '          const conflict = await tx.booking.findFirst({' + "`r`n" +
       '            where: {' + "`r`n" +
       '              instructorId: booking.instructorId,' + "`r`n" +
       '              id: { not: bookingId },' + "`r`n" +
       '              deletedAt: null,' + "`r`n" +
       '              status: { in: [''PENDING'', ''PENDING_PAYMENT'', ''CONFIRMED''] },' + "`r`n" +
       '              startTime: { lt: newEndTime },' + "`r`n" +
       '              endTime:   { gt: newStartTime },' + "`r`n" +
       '            } as any,' + "`r`n" +
       '          });' + "`r`n" +
       '          if (conflict) throw Object.assign(new Error(''SLOT_CONFLICT''), { code: ''SLOT_CONFLICT'' });' + "`r`n" +
       '        }' + "`r`n" +
       "`r`n" +
       '        // Wallet adjustment for price change (if any)' + "`r`n" +
       '        if (priceDifference > 0) {' + "`r`n" +
       '          // Re-check balance inside tx — use aggregate, not findMany (performance + correctness)' + "`r`n" +
       '          const [credits, debits] = await Promise.all([' + "`r`n" +
       '            tx.walletTransaction.aggregate({ where: { walletId: wallet.id, status: ''CONFIRMED'', type: ''CREDIT'' }, _sum: { amount: true } }),' + "`r`n" +
       '            tx.walletTransaction.aggregate({ where: { walletId: wallet.id, status: ''CONFIRMED'', type: ''DEBIT''  }, _sum: { amount: true } }),' + "`r`n" +
       '          ]);' + "`r`n" +
       '          const txBalance = (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0);'

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [IO.File]::WriteAllText($file, $content)
    Write-Host "Done. Slot conflict check + aggregate balance added."
} else {
    # Try unix line endings
    $old2 = $old.Replace("`r`n", "`n")
    $new2 = $new.Replace("`r`n", "`n")
    if ($content.Contains($old2)) {
        $content = $content.Replace($old2, $new2)
        [IO.File]::WriteAllText($file, $content)
        Write-Host "Done (LF). Slot conflict check + aggregate balance added."
    } else {
        Write-Host "ERROR: pattern not found"
        # Show context around the transaction
        $idx = $content.IndexOf("updatedBooking = await prisma.`$transaction")
        if ($idx -gt 0) { Write-Host "Found transaction at index $idx"; Write-Host $content.Substring($idx, [Math]::Min(400, $content.Length - $idx)) }
        exit 1
    }
}
