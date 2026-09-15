param([string]$Root = "e:\DOC\AI voice assistance - Copy - Copy\drivebook")
$file = "$Root\app\dashboard\page.tsx"
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
$updated = $content
$updated = $updated.Replace("instructorId: session.user.providerId,", "instructorId: resolvedProviderId,")
$updated = $updated.Replace("where: { instructorId: session.user.providerId }", "where: { instructorId: resolvedProviderId }")
$updated = $updated.Replace("where: { id: session.user.providerId }", "where: { id: resolvedProviderId }")
if ($updated -ne $content) {
    $newBytes = [System.Text.Encoding]::UTF8.GetBytes($updated)
    [System.IO.File]::WriteAllBytes($file, $newBytes)
    Write-Host "Updated"
} else {
    Write-Host "No changes"
}
