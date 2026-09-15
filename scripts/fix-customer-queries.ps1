$root = "E:\DOC\AI voice assistance - Copy - Copy\drivebook"

$files = @(
    "app\api\analytics\route.ts",
    "app\api\bookings\offline\route.ts",
    "app\api\instructor\client-lesson-feedback\route.ts",
    "app\api\instructor\clients\[id]\route.ts",
    "app\api\public\bookings\[id]\cancel\route.ts",
    "app\api\public\bookings\[id]\reschedule\route.ts"
)

foreach ($rel in $files) {
    $path = Join-Path $root $rel
    if (-not (Test-Path $path)) { continue }
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $orig = $content

    # Replace providerId filter on customer queries with booking-based filter
    # Pattern: { providerId: X } in customer where -> { bookings: { some: { providerId: X } } }
    $content = $content -replace 'providerId:\s*(session!\.user!\.providerId|providerId|resolvedProviderId)(\s*,)', 'bookings: { some: { providerId: $1 } }$2'

    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Fixed: $rel"
    }
}
