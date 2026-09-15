# Fix the broken subject line in email.ts
# The PowerShell replacement dropped the opening backtick from the template literal.

$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\lib\services\email.ts"
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# The broken line is missing the opening backtick before ${
$broken = "subject: `${(data as any).bookingLabel ?? 'Appointment'} Confirmed"
$fixed  = 'subject: `${(data as any).bookingLabel ?? ' + "'" + 'Appointment' + "'" + '} Confirmed'

$updated = $content.Replace($broken, $fixed)

if ($updated -ne $content) {
    $newBytes = [System.Text.Encoding]::UTF8.GetBytes($updated)
    [System.IO.File]::WriteAllBytes($file, $newBytes)
    Write-Host "Fixed subject line in email.ts"
} else {
    Write-Host "Pattern not found — checking alternate form"
    # Try the exact raw string from the file
    $bytes2 = [System.IO.File]::ReadAllBytes($file)
    $raw = [System.Text.Encoding]::UTF8.GetString($bytes2)
    $idx = $raw.IndexOf("subject: `$")
    Write-Host "Index of broken pattern: $idx"
    if ($idx -ge 0) {
        Write-Host "Context: $($raw.Substring([Math]::Max(0,$idx-10), 80))"
    }
}
