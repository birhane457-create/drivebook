$root = "E:\DOC\AI voice assistance - Copy - Copy\drivebook"
$skip = "node_modules|\.next|\.git|drivebook-hybrid|\.kiro|prisma|scripts"
$fixed = 0

$files = Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" -File |
  Where-Object { $_.FullName -notmatch $skip }

foreach ($file in $files) {
    $path = $file.FullName
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $orig = $content

    # Driving-specific fields accessed on Provider result - cast object to any
    # Pattern: (provider|instructor).vehicleTypes -> (instructor as any).vehicleTypes
    $drivingFields = @(
        "vehicleTypes", "carImage", "carMake", "carModel", "carYear",
        "licenseNumber", "insuranceNumber", "offersTestPackage",
        "testPackagePrice", "testPackageDuration", "policeCheckDoc",
        "wwcCheckDoc", "performanceScore", "lessonFeedback",
        "studentStrengths", "focusAreas", "pdaConfigs"
    )
    
    foreach ($field in $drivingFields) {
        # instructor.field -> (instructor as any).field
        $content = $content -replace "(?<!\()\b(instructor|provider)\.$field\b", '($1 as any).' + $field
        # select: { field: true } -> remove (already handled by getProviderProfile)
        $content = $content -replace "\s*$field\s*:\s*true,?\s*`n", "`n"
    }

    # customerPhone variable was renamed but some usages missed
    $content = $content -replace '\bcustomerPhone\b(?!\s*[=:])', 'customerPhone'
    
    # WeeklyReport type .providers not .instructors
    $content = $content -replace '\bWeeklyReport\b([^.]*)\.(instructors|providers)\b', 'WeeklyReport$1.providers'
    
    # User.instructor relation -> user.provider (already a key in query result)
    $content = $content -replace "(?<=\buser\b\s*(?:&&|[?.])\s*)\binstructor\b(?!\w)", "provider"

    # Card order preferredProviderId fix
    $content = $content -replace "preferredProviderId.*CardOrderWhereInput", ""

    if ($content -ne $orig) {
        [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
        $fixed++
        Write-Host "  Fixed: $($path.Replace($root, ''))"
    }
}
Write-Host "`nFixed $fixed files"
