# rename-session-fields.ps1
# Renames session.user.instructorId -> session.user.providerId
# and session.user.clientId -> session.user.customerId
# across all TypeScript files in the app/ and lib/ directories.
# Safe to run multiple times (idempotent).

param(
    [string]$Root = "e:\DOC\AI voice assistance - Copy - Copy\drivebook"
)

$dirs = @("$Root\app", "$Root\lib", "$Root\components", "$Root\hooks")
$extensions = @("*.ts", "*.tsx")
$total = 0

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) { continue }
    $files = Get-ChildItem -Path $dir -Recurse -Include $extensions -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $original = [System.IO.File]::ReadAllText($file.FullName)
        $updated = $original
        $updated = $updated.Replace("user?.instructorId", "user?.providerId")
        $updated = $updated.Replace("user.instructorId",  "user.providerId")
        $updated = $updated.Replace("user?.clientId",     "user?.customerId")
        $updated = $updated.Replace("user.clientId",      "user.customerId")
        if ($updated -ne $original) {
            [System.IO.File]::WriteAllText($file.FullName, $updated)
            Write-Host "  Updated: $($file.FullName)"
            $total++
        }
    }
}

Write-Host ""
Write-Host "Done. Updated $total files."
