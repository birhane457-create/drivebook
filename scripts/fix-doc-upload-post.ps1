$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\app\api\instructor\documents\route.ts"
$content = [IO.File]::ReadAllText($file)

# Find the comment that marks the start of the write block
$startMarker = "    // Write to Instructor (backward compat) AND DrivingProviderProfile (new extension table)"
$startIdx = $content.IndexOf($startMarker)
if ($startIdx -lt 0) { Write-Host "ERROR: start marker not found"; exit 1 }

# Find the end — the last line of the catch block for the extension table
$endMarker = "    } catch { /* extension table may not be available"
$endIdx = $content.IndexOf($endMarker, $startIdx)
if ($endIdx -lt 0) { Write-Host "ERROR: end marker not found"; exit 1 }

# Find the closing } of the catch block
$closingIdx = $content.IndexOf("}", $endIdx + $endMarker.Length)
if ($closingIdx -lt 0) { Write-Host "ERROR: closing brace not found"; exit 1 }

# Include any trailing whitespace/newline
$blockEnd = $closingIdx + 1
# Eat the newline after the closing brace
while ($blockEnd -lt $content.Length -and ($content[$blockEnd] -eq "`r" -or $content[$blockEnd] -eq "`n")) {
    $blockEnd++
}

$replacement = @'
    // Write to DrivingProviderProfile (D7: doc fields removed from Instructor)
    const drivingDocFields = [
      'licenseImageFront', 'licenseImageBack', 'insurancePolicyDoc', 'policeCheckDoc',
      'wwcCheckDoc', 'photoIdDoc', 'certificationDoc', 'vehicleRegistrationDoc',
    ];
    if (drivingDocFields.includes(documentType)) {
      await (prisma as any).drivingProviderProfile.upsert({
        where: { providerId: session.user.providerId },
        create: { providerId: session.user.providerId, [documentType]: result.url },
        update: { [documentType]: result.url },
      });
    } else {
      // profileImage and carImage remain on Instructor (generic provider fields)
      await prisma.instructor.update({
        where: { id: session.user.providerId },
        data: { [documentType]: result.url } as any,
      });
    }

'@

$newContent = $content.Substring(0, $startIdx) + $replacement + $content.Substring($blockEnd)
[IO.File]::WriteAllText($file, $newContent)
Write-Host "Done."
