# Migration Script: instructor to provider
# Renames prisma.instructor to prisma.provider in service files

$files = @(
    "lib\services\availability.ts",
    "lib\services\payment.ts",
    "lib\services\stripe.ts",
    "lib\services\travelTime.ts",
    "lib\services\waiting-list-notify.ts",
    "lib\services\voice-line-service.ts",
    "lib\services\payout-service.ts",
    "lib\services\googleCalendar.ts",
    "lib\services\booking-service.ts",
    "lib\utils\routing.ts",
    "lib\utils\subdomain.ts",
    "lib\website\fetchProviderWebsiteData.ts"
)

foreach ($file in $files) {
    $path = Join-Path "e:\DOC\AI voice assistance - Copy - Copy\drivebook" $file
    if (Test-Path $path) {
        Write-Host "Processing: $file" -ForegroundColor Cyan
        $content = Get-Content $path -Raw
        $originalContent = $content
        
        $content = $content -replace 'prisma\.instructor', 'prisma.provider'
        
        if ($content -ne $originalContent) {
            Set-Content $path -Value $content -NoNewline
            Write-Host "  Updated" -ForegroundColor Green
        } else {
            Write-Host "  No changes needed" -ForegroundColor Gray
        }
    } else {
        Write-Host "  File not found: $path" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Migration complete!" -ForegroundColor Green
