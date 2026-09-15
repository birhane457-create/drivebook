$root = "E:\DOC\AI voice assistance - Copy - Copy\drivebook"
$skip = "node_modules|\.next|\.git|drivebook-hybrid|\.kiro"
$fixed = 0

$allFiles = Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" |
  Where-Object { $_.FullName -notmatch $skip }

foreach ($file in $allFiles) {
    $path = $file.FullName
    $c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $o = $c

    # Fix preferredProviderId in BookingWhereInput, PDATestConfig, CardOrder -> providerId
    $c = $c -replace 'preferredProviderId: providerId', 'providerId: providerId'

    # Fix implicit any on simple callback params
    $c = $c -replace '\(booking\) =>', '(booking: any) =>'
    $c = $c -replace '\(index\) =>', '(index: number) =>'
    $c = $c -replace '\(inst\) =>', '(inst: any) =>'
    $c = $c -replace '\(r\) =>', '(r: any) =>'
    $c = $c -replace '\(b\) =>', '(b: any) =>'
    $c = $c -replace '\(v\) =>', '(v: any) =>'
    $c = $c -replace '\(code\) =>', '(code: any) =>'
    $c = $c -replace '\(c\) =>', '(c: any) =>'

    if ($c -ne $o) {
        [System.IO.File]::WriteAllText($path, $c, [System.Text.Encoding]::UTF8)
        $fixed++
        Write-Host "Fixed: $($path.Replace($root, ''))"
    }
}

Write-Host ""
Write-Host "Fixed $fixed files"
