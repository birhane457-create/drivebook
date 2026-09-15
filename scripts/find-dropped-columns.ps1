$root = "e:\DOC\AI voice assistance - Copy - Copy\drivebook"
$exclude = @("node_modules",".next","prisma","scripts","extensions","migrations",".git","mobile")
$dropped = @(
    "licenseExpiry","insuranceExpiry","policeCheckExpiry","wwcCheckExpiry",
    "licenseImageFront","licenseImageBack","insurancePolicyDoc",
    "policeCheckDoc","wwcCheckDoc","certificationDoc","photoIdDoc",
    "vehicleRegistrationDoc","offersTestPackage","testPackageDuration",
    "testPackageIncludes","testPackagePrice","carMake","carModel","carYear",
    "assessmentType:","lessonTopics:","studentStrengths","focusAreas","lessonFeedback",
    "whiteboardSketchUrl","feedbackGivenAt","instructorNotes","performanceScore"
)

$files = Get-ChildItem -Path $root -Recurse -Include "*.ts","*.tsx" -ErrorAction SilentlyContinue
$hits = @()

foreach ($f in $files) {
    $skip = $false
    foreach ($ex in $exclude) {
        if ($f.FullName -like ("*\" + $ex + "\*")) { $skip = $true; break }
    }
    if ($skip) { continue }

    $c = [IO.File]::ReadAllText($f.FullName)
    $matched = @()
    foreach ($d in $dropped) {
        # Only flag if it looks like a Prisma where/select field (preceded by whitespace or {)
        if ($c -match [regex]::Escape($d)) { $matched += $d }
    }
    if ($matched.Count -gt 0) {
        $hits += [PSCustomObject]@{ File = $f.FullName; Fields = ($matched -join ", ") }
    }
}

Write-Host "Files with references to dropped D7 columns:"
$hits | ForEach-Object { Write-Host ("  " + $_.File); Write-Host ("    -> " + $_.Fields) }
Write-Host ""
Write-Host ("Total: " + $hits.Count + " files")
