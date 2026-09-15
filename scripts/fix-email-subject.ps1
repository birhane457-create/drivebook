# Fixes the broken subject line in email.ts
# Reads raw bytes to handle mojibake encoding, replaces the broken subject pattern.

$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\lib\services\email.ts"
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# Find all variations of the broken subject line and replace with a safe string concat
$patterns = @(
    # Pattern 1: missing opening backtick (what was written by the earlier script)
    'subject: ${(data as any).bookingLabel',
    # Pattern 2: any remaining variant
    "subject: `${(data as any)"
)

$replacement = 'subject: ((data as any).bookingLabel ?? ' + "'Appointment') + ' Confirmed',"

$found = $false
foreach ($p in $patterns) {
    if ($content.Contains($p)) {
        # Find end of the subject line — find the next comma after the pattern
        $idx = $content.IndexOf($p)
        $lineEnd = $content.IndexOf(',', $idx)
        if ($lineEnd -gt $idx) {
            $brokenLine = $content.Substring($idx, $lineEnd - $idx + 1)
            Write-Host "Found broken line: $brokenLine"
            $content = $content.Replace($brokenLine, $replacement)
            $found = $true
            break
        }
    }
}

if ($found) {
    $newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    [System.IO.File]::WriteAllBytes($file, $newBytes)
    Write-Host "Fixed."
} else {
    # Dump surrounding context to diagnose
    $subjectIdx = $content.IndexOf('subject:')
    if ($subjectIdx -ge 0) {
        Write-Host "Subject line context:"
        Write-Host $content.Substring($subjectIdx, [Math]::Min(120, $content.Length - $subjectIdx))
    } else {
        Write-Host "Could not find subject: in file"
    }
}
