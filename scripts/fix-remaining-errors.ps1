$root = "E:\DOC\AI voice assistance - Copy - Copy\drivebook"
$skipDirs = "node_modules|\.next|\.git|drivebook-hybrid|\.kiro|scripts|prisma"
$fixed = 0

$tsFiles = Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" -File |
  Where-Object { $_.FullName -notmatch $skipDirs }

foreach ($file in $tsFiles) {
    $path = $file.FullName
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $orig = $content

    # Fix: preferredProviderId wrongly placed in BookingWhereInput (over-replacement)
    $content = $content -replace 'preferredProviderId:\s*providerId(?=\s*[,}])', 'providerId: providerId'
    $content = $content -replace 'preferredProviderId:\s*session!\.user!\.providerId', 'providerId: session!.user!.providerId'
    $content = $content -replace 'preferredProviderId:\s*session\.user\.providerId', 'providerId: session.user.providerId'
    $content = $content -replace 'preferredProviderId:\s*resolvedProviderId', 'providerId: resolvedProviderId'
    $content = $content -replace 'preferredProviderId:\s*instructorId', 'providerId: providerId'

    # Fix: preferredProviderId in ledger entry / non-Customer objects
    $content = $content -replace 'preferredProviderId:\s*booking\.providerId', 'providerId: booking.providerId'
    $content = $content -replace 'preferredProviderId:\s*payout\.providerId', 'providerId: payout.providerId'

    # Fix dashboard/page.tsx any[] arrow fn missing types
    $content = $content -replace '\(booking,\s*index\)\s*=>', '(booking: any, index: number) =>'
    $content = $content -replace '\(booking\)\s*=>\s*\{', '(booking: any) => {'

    # Fix implicit any params in map/filter callbacks
    $content = $content -replace '\(r\)\s*=>\s*r\b', '(r: any) => r'
    $content = $content -replace '\(v\)\s*=>\s*v\.', '(v: any) => v.'
    $content = $content -replace '\(b\)\s*=>\s*b\.', '(b: any) => b.'
    $content = $content -replace '\(inst\)\s*=>', '(inst: any) =>'
    $content = $content -replace '\(i\)\s*=>\s*i\.', '(i: any) => i.'
    $content = $content -replace '\(c\)\s*=>\s*c\.', '(c: any) => c.'

    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        $script:fixed++
        Write-Host "  Fixed: $($path.Replace($root,''))"
    }
}

Write-Host ""
Write-Host "Fixed $fixed files"
