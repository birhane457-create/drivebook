# Check remaining old session field names
$root = "e:\DOC\AI voice assistance - Copy - Copy\drivebook"
$results = @()
$files = Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules|\.next|\.git|scripts" }

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    if ($content -match "user\?\.instructorId|user\.instructorId|user\?\.clientId|user\.clientId") {
        $results += $file.FullName
    }
}

Write-Host "Files with old session field names: $($results.Count)"
foreach ($r in $results) { Write-Host "  $r" }
