$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\app\admin\page.tsx"
$content = [IO.File]::ReadAllText($file)

$old = '      prisma.instructor.count({' + "`r`n" +
'        where: {' + "`r`n" +
'          approvalStatus: ''APPROVED'',' + "`r`n" +
'          OR: [' + "`r`n" +
'            { licenseExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'            { insuranceExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'            { policeCheckExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'            { wwcCheckExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'          ],' + "`r`n" +
'        },' + "`r`n" +
'      }).catch(() => 0),'

$new = '      // Expiring docs now live in DrivingProviderProfile (D7 migration)' + "`r`n" +
'      (prisma as any).drivingProviderProfile.count({' + "`r`n" +
'        where: {' + "`r`n" +
'          OR: [' + "`r`n" +
'            { licenseExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'            { insuranceExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'            { policeCheckExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'            { wwcCheckExpiry: { gte: now, lte: thirtyDaysFromNow } },' + "`r`n" +
'          ],' + "`r`n" +
'        },' + "`r`n" +
'      }).catch(() => 0),'

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [IO.File]::WriteAllText($file, $content)
    Write-Host "Done."
} else {
    # Try LF
    $old2 = $old.Replace("`r`n", "`n")
    $new2 = $new.Replace("`r`n", "`n")
    if ($content.Contains($old2)) {
        $content = $content.Replace($old2, $new2)
        [IO.File]::WriteAllText($file, $content)
        Write-Host "Done (LF)."
    } else {
        Write-Host "ERROR: pattern not found"
        exit 1
    }
}
