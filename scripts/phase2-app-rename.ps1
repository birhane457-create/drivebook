# phase2-app-rename.ps1
# Phase 2 application-layer renames — generic terminology in non-DB code.
# Does NOT touch: prisma schema, DB column names, or variable names that
# map directly to DB fields (instructorId, clientId as DB fields are fine).
#
# What this renames:
#   - session.user.instructorId  -> session.user.providerId   (done in prev script)
#   - session.user.clientId      -> session.user.customerId   (done in prev script)
#   - LESSON_REMINDER (notification type) -> APPOINTMENT_REMINDER
#
# What this does NOT rename (DB field names — Phase 2 migration):
#   - prisma.instructor / instructorId as a DB FK
#   - prisma.client / clientId as a DB FK

param(
    [string]$Root = "e:\DOC\AI voice assistance - Copy - Copy\drivebook"
)

$dirs = @("$Root\app", "$Root\lib", "$Root\components", "$Root\hooks")
$extensions = @("*.ts", "*.tsx")
$total = 0

$replacements = @(
    # Notification type rename
    @{ From = "'LESSON_REMINDER'";  To = "'APPOINTMENT_REMINDER'" },
    @{ From = '"LESSON_REMINDER"';  To = '"APPOINTMENT_REMINDER"' }
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) { continue }
    $files = Get-ChildItem -Path $dir -Recurse -Include $extensions -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "node_modules|\.next|\.git" }
    foreach ($file in $files) {
        $original = [System.IO.File]::ReadAllText($file.FullName)
        $updated = $original
        foreach ($r in $replacements) {
            $updated = $updated.Replace($r.From, $r.To)
        }
        if ($updated -ne $original) {
            [System.IO.File]::WriteAllText($file.FullName, $updated)
            Write-Host "  Updated: $($file.FullName)"
            $total++
        }
    }
}

Write-Host ""
Write-Host "Done. Updated $total files."
