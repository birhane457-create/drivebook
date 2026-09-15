$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\app\api\bookings\[id]\cancel\route.ts"
$content = [IO.File]::ReadAllText($file)

# Remove the old redundant FinancialLedger block (now handled by BookingService)
# Find the comment start
$startMarker = "    // FinancialLedger"
$startIdx = $content.IndexOf($startMarker)
if ($startIdx -lt 0) { Write-Host "ERROR: start marker not found"; exit 1 }

# Find the end of the block — the line just before "    // Email notifications"
$endMarker = "    // Email notifications (non-critical)"
$endIdx = $content.IndexOf($endMarker)
if ($endIdx -lt 0) { Write-Host "ERROR: end marker not found"; exit 1 }

# Also remove the duplicate auditLog.create — BookingService writes audit internally
# Find the audit log block that starts with "    // Audit log"
$auditMarker = "    // Audit log`r`n    await prisma.auditLog.create("
if ($content.IndexOf($auditMarker) -lt 0) {
    $auditMarker = "    // Audit log`n    await prisma.auditLog.create("
}
$auditIdx = $content.IndexOf($auditMarker)

if ($auditIdx -gt 0 -and $auditIdx -lt $startIdx) {
    # Find where the audit block ends — closing }) followed by blank line
    # Look for the '    })' after the auditLog.create
    $auditEnd = $content.IndexOf("`n    })`r`n", $auditIdx)
    if ($auditEnd -lt 0) { $auditEnd = $content.IndexOf("`n    })`n", $auditIdx) }
    if ($auditEnd -gt 0) {
        $auditBlockEnd = $auditEnd + "`n    })`r`n".Length
        $newContent = $content.Substring(0, $auditIdx) + $content.Substring($auditBlockEnd)
        $content = $newContent
        Write-Host "Removed duplicate audit log block"
        # Recalculate indices
        $startIdx = $content.IndexOf("    // FinancialLedger")
        $endIdx = $content.IndexOf("    // Email notifications (non-critical)")
    }
}

# Remove the FinancialLedger block
$newContent = $content.Substring(0, $startIdx) + $content.Substring($endIdx)
[IO.File]::WriteAllText($file, $newContent)
Write-Host "Done. Ledger block removed."
