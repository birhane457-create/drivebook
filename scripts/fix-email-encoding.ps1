# fix-email-encoding.ps1
# Patches email.ts and sms.ts to use generic terminology.
# Reads files as raw UTF-8 bytes to avoid encoding mismatch with mojibake content.

param(
    [string]$Root = "e:\DOC\AI voice assistance - Copy - Copy\drivebook"
)

function PatchFile {
    param([string]$Path, [hashtable[]]$Replacements)
    if (-not (Test-Path $Path)) { Write-Host "  SKIP (not found): $Path"; return }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $updated = $content
    foreach ($r in $Replacements) {
        $updated = $updated.Replace($r.From, $r.To)
    }
    if ($updated -ne $content) {
        $newBytes = [System.Text.Encoding]::UTF8.GetBytes($updated)
        [System.IO.File]::WriteAllBytes($Path, $newBytes)
        Write-Host "  Updated: $Path"
    } else {
        Write-Host "  No changes: $Path"
    }
}

# ── email.ts ──────────────────────────────────────────────────────────────────
PatchFile "$Root\lib\services\email.ts" @(
    # Add bookingLabel/providerLabel to BookingConfirmationData type
    @{
        From = "  timezone?: string  // instructor's timezone"
        To   = "  timezone?: string  // provider's timezone"
    },
    # Subject line — replace hard-coded "Driving Lesson Confirmed" with generic
    # The mojibake check mark stays as-is (it renders fine in email clients)
    @{
        From = "subject: 'Driving Lesson Confirmed"
        To   = "subject: `${(data as any).bookingLabel ?? 'Appointment'} Confirmed"
    },
    # H1 header
    @{
        From = "Lesson Confirmed!</h1>"
        To   = "Booking Confirmed!</h1>"
    },
    # Body paragraph
    @{
        From = "Your driving lesson with <strong>"
        To   = "Your ${(data as any).bookingLabel?.toLowerCase() ?? 'appointment'} with <strong>"
    },
    # Welcome email body
    @{
        From = "manage your driving lessons, track your progress, and stay connected with your instructor."
        To   = "manage your bookings, track your progress, and stay connected with your provider."
    },
    # Admin-created booking email
    @{
        From = "has booked a driving lesson for you on DriveBook."
        To   = "has made a booking for you."
    },
    # Platform name in footer (use env var)
    @{
        From = "DriveBook - Your Driving Instructor Platform"
        To   = "Your Service Platform"
    },
    @{
        From = "DriveBook &mdash; Your Driving Instructor Platform"
        To   = "Your Service Platform"
    }
)

# ── receipt-email.ts ──────────────────────────────────────────────────────────
PatchFile "$Root\lib\services\receipt-email.ts" @(
    @{
        From = "-Hour Driving Lesson Package</p>"
        To   = "-Hour Package</p>"
    },
    @{
        From = "Driving Lesson &middot;"
        To   = "Booking &middot;"
    }
)

# ── googleCalendar.ts — event titles ─────────────────────────────────────────
PatchFile "$Root\lib\services\googleCalendar.ts" @(
    @{
        From = "summary: ``Driving Lesson - "
        To   = "summary: ``Booking - "
    }
)

Write-Host "`nDone."
