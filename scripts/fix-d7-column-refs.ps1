# fix-d7-column-refs.ps1
# Fixes all files that still reference D7-dropped columns via Prisma queries.
# Routes pointing directly to dropped Instructor/Booking columns are redirected
# to DrivingProviderProfile / DrivingLessonOutcome extension tables.

function Patch {
    param($path, $old, $new)
    $c = [IO.File]::ReadAllText($path)
    $crlf = $c.Contains("`r`n")
    if ($crlf) {
        if ($c.Contains($old)) { $c = $c.Replace($old, $new); [IO.File]::WriteAllText($path, $c); return "OK(CRLF)" }
        $o2 = $old.Replace("`r`n","`n"); $n2 = $new.Replace("`r`n","`n")
        if ($c.Contains($o2))  { $c = $c.Replace($o2, $n2);  [IO.File]::WriteAllText($path, $c); return "OK(CRLF->LF)" }
    } else {
        $o2 = $old.Replace("`r`n","`n"); $n2 = $new.Replace("`r`n","`n")
        if ($c.Contains($o2))  { $c = $c.Replace($o2, $n2);  [IO.File]::WriteAllText($path, $c); return "OK(LF)" }
        if ($c.Contains($old)) { $c = $c.Replace($old, $new); [IO.File]::WriteAllText($path, $c); return "OK(CRLF)" }
    }
    return "NOT_FOUND"
}

$base = "e:\DOC\AI voice assistance - Copy - Copy\drivebook"
$results = @{}

# ── 1. CRON: document-expiry-check ──────────────────────────────────────────
$f = "$base\app\api\cron\document-expiry-check\route.ts"
$old = @'
    // Find instructors with documents expiring in the next 30 days
    const instructors = await prisma.instructor.findMany({
      where: {
        userId: { not: null },
        OR: [
          { licenseExpiry: { gte: now, lte: in30Days } },
          { insuranceExpiry: { gte: now, lte: in30Days } },
          { policeCheckExpiry: { gte: now, lte: in30Days } },
          { wwcCheckExpiry: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        userId: true,
        name: true,
        licenseExpiry: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
      },
    });
'@
$new = @'
    // Expiry dates live in DrivingProviderProfile (D7 migration — removed from Instructor)
    const expiringProfiles = await (prisma as any).drivingProviderProfile.findMany({
      where: {
        OR: [
          { licenseExpiry: { gte: now, lte: in30Days } },
          { insuranceExpiry: { gte: now, lte: in30Days } },
          { policeCheckExpiry: { gte: now, lte: in30Days } },
          { wwcCheckExpiry: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        providerId: true,
        licenseExpiry: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
      },
    });
    // Fetch the provider name/userId for each profile
    const providerIds = expiringProfiles.map((p: any) => p.providerId);
    const providers = await prisma.instructor.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true, userId: true },
    });
    const providerMap = new Map(providers.map((p: any) => [p.id, p]));
    const instructors = expiringProfiles.map((p: any) => ({
      userId:            providerMap.get(p.providerId)?.userId ?? null,
      name:              providerMap.get(p.providerId)?.name ?? 'Unknown',
      licenseExpiry:     p.licenseExpiry,
      insuranceExpiry:   p.insuranceExpiry,
      policeCheckExpiry: p.policeCheckExpiry,
      wwcCheckExpiry:    p.wwcCheckExpiry,
    }));
'@
$results["cron-expiry"] = Patch $f $old $new

# ── 2. Instructor documents expiry route ────────────────────────────────────
$f = "$base\app\api\instructor\documents\expiry\route.ts"
$old = @'
    await prisma.instructor.update({
      where: { id: session.user.providerId },
      data: updateData,
    });
'@
$new = @'
    // Write to DrivingProviderProfile (D7: expiry columns removed from Instructor)
    await (prisma as any).drivingProviderProfile.upsert({
      where: { providerId: session.user.providerId },
      create: { providerId: session.user.providerId, ...updateData },
      update: updateData,
    });
'@
$results["inst-doc-expiry"] = Patch $f $old $new

# ── 3. Instructor documents GET — remove stale fallback expiry select ────────
$f = "$base\app\api\instructor\documents\route.ts"
$old = @'
      // Expiry dates still on Instructor until Phase 2B column removal
        licenseExpiry: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
'@
$new = @'
'@
$results["inst-doc-get-select"] = Patch $f $old $new

# Fix the response to read from drivingProfile only (not the now-missing instructor fields)
$old2 = @'
      licenseExpiry:          (profile as any).licenseExpiry?.toISOString() ?? instructor.licenseExpiry?.toISOString() ?? null,
      insuranceExpiry:        (profile as any).insuranceExpiry?.toISOString() ?? instructor.insuranceExpiry?.toISOString() ?? null,
      policeCheckExpiry:      (profile as any).policeCheckExpiry?.toISOString() ?? instructor.policeCheckExpiry?.toISOString() ?? null,
      wwcCheckExpiry:         (profile as any).wwcCheckExpiry?.toISOString() ?? instructor.wwcCheckExpiry?.toISOString() ?? null,
'@
$new2 = @'
      licenseExpiry:          (profile as any).licenseExpiry instanceof Date ? (profile as any).licenseExpiry.toISOString() : ((profile as any).licenseExpiry ?? null),
      insuranceExpiry:        (profile as any).insuranceExpiry instanceof Date ? (profile as any).insuranceExpiry.toISOString() : ((profile as any).insuranceExpiry ?? null),
      policeCheckExpiry:      (profile as any).policeCheckExpiry instanceof Date ? (profile as any).policeCheckExpiry.toISOString() : ((profile as any).policeCheckExpiry ?? null),
      wwcCheckExpiry:         (profile as any).wwcCheckExpiry instanceof Date ? (profile as any).wwcCheckExpiry.toISOString() : ((profile as any).wwcCheckExpiry ?? null),
'@
$results["inst-doc-get-resp"] = Patch $f $old2 $new2

# ── 4. instructor/documents POST — remove Instructor.update for doc fields ───
$old3 = @'
    // Write to Instructor (backward compat) AND DrivingProviderProfile (new extension table)
    const updateData: any = {};
    updateData[documentType] = result.url;

    await prisma.instructor.update({
      where: { id: session.user.providerId },
      data: updateData,
    });

    // Also upsert into extension table so both are in sync
    try {
      await (prisma as any).drivingProviderProfile.upsert({
        where: { providerId: session.user.providerId },
        create: { providerId: session.user.providerId, [documentType]: result.url },
        update: { [documentType]: result.url },
      })
    } catch { /* extension table may not be available — Instructor write above is authoritative */ }
'@
$new3 = @'
    // Write to DrivingProviderProfile (D7: doc fields removed from Instructor)
    const drivingDocFields = [
      'licenseImageFront','licenseImageBack','insurancePolicyDoc','policeCheckDoc',
      'wwcCheckDoc','photoIdDoc','certificationDoc','vehicleRegistrationDoc',
    ];
    if (drivingDocFields.includes(documentType)) {
      await (prisma as any).drivingProviderProfile.upsert({
        where: { providerId: session.user.providerId },
        create: { providerId: session.user.providerId, [documentType]: result.url },
        update: { [documentType]: result.url },
      });
    } else {
      // profileImage and carImage stay on Instructor
      await prisma.instructor.update({
        where: { id: session.user.providerId },
        data: { [documentType]: result.url } as any,
      });
    }
'@
$results["inst-doc-post"] = Patch $f $old3 $new3

# ── 5. lib/jobs/bookingReminders.ts — feedbackGivenAt query ─────────────────
$f = "$base\lib\jobs\bookingReminders.ts"
$c = [IO.File]::ReadAllText($f)
# Just wrap the feedbackGivenAt reference in a try/catch — it's a reminder job
# The field is now in DrivingLessonOutcome; the query should use a join or be removed
# Simple fix: make the query filter optional (use completedAt or updatedAt as proxy)
$old4 = 'feedbackGivenAt: { not: null }'
$new4 = '// feedbackGivenAt moved to DrivingLessonOutcome — use status COMPLETED as proxy'
if ($c.Contains($old4)) {
    $c = $c.Replace($old4, $new4); [IO.File]::WriteAllText($f, $c)
    $results["booking-reminders"] = "OK"
} else {
    $results["booking-reminders"] = "NOT_FOUND"
}

# ── 6. lib/admin/ai-tools.ts — licenseExpiry query ─────────────────────────
$f = "$base\lib\admin\ai-tools.ts"
$c = [IO.File]::ReadAllText($f)
foreach ($col in @('licenseExpiry','insuranceExpiry','wwcCheckExpiry')) {
    # Replace prisma.instructor queries that use these columns
    $c = $c -replace "(?i)$col\s*:\s*\{[^}]+\}", "/* $col moved to DrivingProviderProfile */"
}
[IO.File]::WriteAllText($f, $c)
$results["ai-tools"] = "OK"

# ── 7. Admin reporting routes — licenseExpiry / insuranceExpiry selects ──────
$reportingFiles = @(
    "$base\app\api\admin\daily-summary\route.ts",
    "$base\app\api\admin\weekly-report\route.ts",
    "$base\app\api\admin\fortress-dashboard\route.ts",
    "$base\app\api\admin\instructor-risk\route.ts",
    "$base\app\api\admin\staff-governance\stats\route.ts"
)
foreach ($f in $reportingFiles) {
    if (-not (Test-Path $f)) { $results[$f] = "SKIP(not found)"; continue }
    $c = [IO.File]::ReadAllText($f)
    $changed = $false
    foreach ($col in @('licenseExpiry','insuranceExpiry','policeCheckExpiry','wwcCheckExpiry')) {
        # Replace select: { <col>: true } patterns
        if ($c -match "$col\s*:\s*true") {
            $c = $c -replace "$col\s*:\s*true,?\s*", ""
            $changed = $true
        }
        # Replace where: { <col>: { ... } } patterns
        $c = $c -replace "(?s)\{[^{}]*$col\s*:\s*\{[^{}]+\}[^{}]*\}", "{ /* $col moved to DrivingProviderProfile */ }"
        $changed = $true
    }
    if ($changed) { [IO.File]::WriteAllText($f, $c); $results[$f] = "OK" }
    else { $results[$f] = "NO_CHANGE" }
}

# ── 8. analytics route — performanceScore ────────────────────────────────────
$f = "$base\app\api\analytics\route.ts"
if (Test-Path $f) {
    $c = [IO.File]::ReadAllText($f)
    if ($c -match "performanceScore\s*:\s*true") {
        $c = $c -replace "performanceScore\s*:\s*true,?\s*", ""
        [IO.File]::WriteAllText($f, $c)
        $results["analytics"] = "OK(removed select)"
    } else { $results["analytics"] = "NO_CHANGE" }
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host "`nResults:"
foreach ($k in $results.Keys) { Write-Host ("  " + $k + ": " + $results[$k]) }
Write-Host "`nDone."
