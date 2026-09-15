$root = "E:\DOC\AI voice assistance - Copy - Copy\drivebook"
$skip = "node_modules|\.next|\.git|drivebook-hybrid|\.kiro|prisma"
$fixed = 0

$files = Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" -File |
  Where-Object { $_.FullName -notmatch $skip }

foreach ($file in $files) {
    $path = $file.FullName
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $orig = $content

    # session possibly null - add non-null assertion
    $content = $content -replace '(?<!!)session\.user(?!!)', 'session!.user'

    # user.instructor -> user.provider
    $content = $content -replace '\buser\.instructor\b', 'user.provider'

    # subscription tier .instructors -> .providers
    $content = $content -replace '\.instructors\b', '.providers'

    # ActorRole enum access
    $content = $content -replace '\bActorRole\.provider\b', '"PROVIDER"'
    $content = $content -replace '\bActorRole\.instructor\b', '"INSTRUCTOR"'

    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        $fixed++
        Write-Host "  Fixed: $($path.Replace($root, ''))"
    }
}
Write-Host "Total fixed: $fixed files"
