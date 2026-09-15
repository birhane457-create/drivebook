# Final TypeScript error fix pass
param()
$root = "E:\DOC\AI voice assistance - Copy - Copy\drivebook"
$skipDirs = "node_modules|\.next|\.git|drivebook-hybrid|\.kiro"
$fixed = 0

Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" -File |
  Where-Object { $_.FullName -notmatch $skipDirs } |
  ForEach-Object {
    $path = $_.FullName
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $orig = $content

    # instructor→provider in object property access results
    $content = $content -replace '(?<=\w\.)instructor(?=\b)', 'provider'
    # maxInstructors → maxProviders
    $content = $content -replace '\bmaxInstructors\b', 'maxProviders'
    # NoShowParty: 'instructor' → 'provider'
    $content = $content -replace "(?<!')'instructor'(?!')", "'provider'"

    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        $script:fixed++
        Write-Host "Fixed: $($path.Replace($root, ''))"
    }
  }

Write-Host ""
Write-Host "Fixed $fixed files"
