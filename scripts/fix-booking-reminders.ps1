$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\lib\jobs\bookingReminders.ts"
$content = [IO.File]::ReadAllText($file)

# Remove the feedbackGivenAt: null filter (field dropped in D7; status: CONFIRMED is sufficient)
$patterns = @(
    "`r`n        feedbackGivenAt: null,",
    "`n        feedbackGivenAt: null,",
    "`r`n        feedbackGivenAt: null,`r`n",
    "`n        feedbackGivenAt: null,`n"
)

$changed = $false
foreach ($p in $patterns) {
    if ($content.Contains($p)) {
        # Replace with empty string (removes the line)
        $content = $content.Replace($p, "")
        $changed = $true
        break
    }
}

# Also handle without trailing comma
if (-not $changed) {
    $p2 = "        feedbackGivenAt: null,"
    if ($content.Contains($p2)) {
        $content = $content.Replace($p2, "        // feedbackGivenAt removed (D7: field moved to DrivingLessonOutcome)")
        $changed = $true
    }
}

if ($changed) {
    [IO.File]::WriteAllText($file, $content)
    Write-Host "Done. feedbackGivenAt filter removed from bookingReminders."
} else {
    Write-Host "ERROR: feedbackGivenAt pattern not found"
    $idx = $content.IndexOf("feedbackGivenAt")
    if ($idx -gt 0) { Write-Host "Found at index $idx context: $($content.Substring([Math]::Max(0,$idx-50), [Math]::Min(100, $content.Length-$idx)))" }
    exit 1
}
