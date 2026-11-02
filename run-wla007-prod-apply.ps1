Set-Location "e:\DOC\flowstate-wms\AI voice assistance - Copy - Copy - Copy\drivebook"
$u = (Select-String -Path ".env.production.bak" -Pattern "^DATABASE_URL=").Line.Split('=',2)[1].Trim('"')
if ($u -match '://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
    $env:PGPASSWORD = $Matches[2]
    $o = & "D:\pg16\bin\psql.exe" -h $Matches[3] -p $Matches[4] -d $Matches[5] -U $Matches[1] -f "docs\audit\wla007-apply-index.sql" 2>&1
    $env:PGPASSWORD = $null
    $o | Set-Content "docs\audit\WLA-007-PROD-APPLY-OUTPUT.txt"
    Write-Host "PSQL_DONE"
} else {
    Write-Host "PARSE_FAIL"
}
