# fix-email-service.ps1
# Replaces driving-specific strings in email.ts and related services
# with generic, config-driven alternatives.
# Uses raw byte replacement to avoid encoding issues.

$files = @(
    "e:\DOC\AI voice assistance - Copy - Copy\drivebook\lib\services\email.ts",
    "e:\DOC\AI voice assistance - Copy - Copy\drivebook\lib\services\receipt-email.ts"
)

$replacements = @(
    # email.ts — booking confirmation subject
    @{ From = "subject: 'Driving Lesson Confirmed ";         To = "subject: `${data.bookingLabel ?? 'Appointment'} Confirmed " },
    # email.ts — h1 header in booking confirmation
    @{ From = "Lesson Confirmed!";                           To = "Booking Confirmed!" },
    # email.ts — body text
    @{ From = "Your driving lesson with";                    To = "Your ${data.bookingLabel?.toLowerCase() ?? 'appointment'} with" },
    @{ From = "has booked a driving lesson for you on DriveBook"; To = "has booked an appointment for you" },
    @{ From = "manage your driving lessons, track your progress, and stay connected with your instructor"; To = "manage your bookings, track your progress, and stay connected with your provider" },
    # receipt-email.ts
    @{ From = "-Hour Driving Lesson Package";                To = "-Hour Package" },
    @{ From = "subject: `Receipt ";                          To = "subject: `Receipt " }  # no-op guard
)

$total = 0
foreach ($file in $files) {
    if (-not (Test-Path $file)) { Write-Host "  SKIP (not found): $file"; continue }
    $content = [System.IO.File]::ReadAllText($file)
    $updated = $content
    foreach ($r in $replacements) {
        $updated = $updated.Replace($r.From, $r.To)
    }
    if ($updated -ne $content) {
        [System.IO.File]::WriteAllText($file, $updated)
        Write-Host "  Updated: $file"
        $total++
    }
}
Write-Host "Done. Updated $total files."
