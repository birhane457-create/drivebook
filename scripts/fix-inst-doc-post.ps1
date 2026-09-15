$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\app\api\instructor\documents\route.ts"
$c = [IO.File]::ReadAllText($file)

# Replace the whole write block after Cloudinary upload
$old = "    // Write to Instructor (backward compat) AND DrivingProviderProfile (new extension table)" +
"`r`n    const updateData: any = {};" +
"`r`n    updateData[documentType] = result.url;" +
"`r`n`r`n    await prisma.instructor.update({" +
"`r`n      where: { id: session.user.providerId }," +
"`r`n      data: updateData," +
"`r`n    });" +
"`r`n`r`n    // Also upsert into extension table so both are in sync" +
"`r`n    try {" +
"`r`n      await (prisma as any).drivingProviderProfile.upsert({" +
"`r`n        where: { providerId: session.user.providerId }," +
"`r`n        create: { providerId: session.user.providerId, [documentType]: result.url }," +
"`r`n        update: { [documentType]: result.url }," +
"`r`n      })" +
"`r`n    } catch { /* extension table may not be available — Instructor write above is authoritative */ }"

$new = "    // D7: driving doc fields removed from Instructor — write to DrivingProviderProfile" +
"`r`n    const drivingDocFields = [" +
"`r`n      'licenseImageFront','licenseImageBack','insurancePolicyDoc','policeCheckDoc'," +
"`r`n      'wwcCheckDoc','photoIdDoc','certificationDoc','vehicleRegistrationDoc'," +
"`r`n    ];" +
"`r`n    if (drivingDocFields.includes(documentType)) {" +
"`r`n      await (prisma as any).drivingProviderProfile.upsert({" +
"`r`n        where: { providerId: session.user.providerId }," +
"`r`n        create: { providerId: session.user.providerId, [documentType]: result.url }," +
"`r`n        update: { [documentType]: result.url }," +
"`r`n      });" +
"`r`n    } else {" +
"`r`n      // profileImage and carImage stay on Instructor (generic provider fields)" +
"`r`n      await prisma.instructor.update({" +
"`r`n        where: { id: session.user.providerId }," +
"`r`n        data: { [documentType]: result.url } as any," +
"`r`n      });" +
"`r`n    }"

if ($c.Contains($old)) {
    $c = $c.Replace($old, $new)
    [IO.File]::WriteAllText($file, $c)
    Write-Host "Done (CRLF)"
} else {
    $o2 = $old.Replace("`r`n","`n"); $n2 = $new.Replace("`r`n","`n")
    if ($c.Contains($o2)) {
        $c = $c.Replace($o2,$n2)
        [IO.File]::WriteAllText($file, $c)
        Write-Host "Done (LF)"
    } else {
        Write-Host "Pattern not found — showing current upload section:"
        $idx = $c.IndexOf("Write to Instructor")
        if ($idx -gt 0) { Write-Host $c.Substring($idx, [Math]::Min(600, $c.Length-$idx)) }
    }
}
