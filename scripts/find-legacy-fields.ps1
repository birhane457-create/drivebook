$root = "e:\DOC\AI voice assistance - Copy - Copy\drivebook"
$excludeDirs = @("node_modules", ".next", "prisma", "scripts", "extensions", "migrations", ".git")
$patterns = @("assessmentType", "lessonTopics", "studentStrengths", "focusAreas", "whiteboardSketchUrl", "carMake", "wwcCheckDoc", "licenseNumber", "offersTestPackage", "testPackageDuration", "testPackagePrice", "policeCheckDoc")

$files = Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue
$results = @{}

foreach ($file in $files) {
    $skip = $false
    foreach ($ex in $excludeDirs) {
        if ($file.FullName -like "*\$ex\*") { $skip = $true; break }
    }
    if ($skip) { continue }
    
    $content = [IO.File]::ReadAllText($file.FullName)
    foreach ($pat in $patterns) {
        if ($content.Contains($pat)) {
            if (-not $results[$file.FullName]) {
                $results[$file.FullName] = @()
            }
            $results[$file.FullName] += $pat
        }
    }
}

Write-Host "Files with legacy driving field references:"
foreach ($k in ($results.Keys | Sort-Object)) {
    Write-Host "  $k"
    Write-Host "    Fields: $($results[$k] -join ', ')"
}
Write-Host ""
Write-Host "Total: $($results.Count) files"
