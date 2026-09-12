/**
 * scripts/verify-d4-extension-data.ts
 *
 * D4 Verification Script â€” Extension table data integrity check.
 *
 * Compares the old Instructor/Booking columns against the new
 * DrivingProviderProfile/DrivingLessonOutcome extension tables.
 *
 * Run: npx tsx scripts/verify-d4-extension-data.ts
 *
 * Expected result: zero mismatches before proceeding to D5.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Mismatch {
  entity: string
  id: string
  field: string
  oldValue: unknown
  newValue: unknown
}

const mismatches: Mismatch[] = []
let checked = 0

function compare(
  entity: string,
  id: string,
  field: string,
  oldValue: unknown,
  newValue: unknown
) {
  checked++
  // Normalize: treat null and undefined as equivalent
  const normalize = (v: unknown) => (v === undefined ? null : v)
  const a = normalize(oldValue)
  const b = normalize(newValue)

  if (JSON.stringify(a) !== JSON.stringify(b)) {
    mismatches.push({ entity, id, field, oldValue: a, newValue: b })
  }
}

async function verifyProviderProfiles() {
  console.log('\nâ”€â”€ DrivingProviderProfile vs Instructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€')

  const profiles = await (prisma as any).drivingProviderProfile.findMany()
  console.log(`  Checking ${profiles.length} DrivingProviderProfile records...`)

  for (const profile of profiles) {
    const instructor = await (prisma.provider.findUnique as any)({
      where: { id: profile.providerId },
      select: {
        carMake: true, carYear: true, vehicleRegistrationDoc: true,
        licenseImageFront: true, licenseImageBack: true, insuranceExpiry: true, insurancePolicyDoc: true,
        policeCheckDoc: true, policeCheckExpiry: true,
        wwcCheckDoc: true, wwcCheckExpiry: true,
        certificationDoc: true, photoIdDoc: true,
      },
    })

    if (!instructor) {
      mismatches.push({
        entity: 'DrivingProviderProfile',
        id: profile.providerId,
        field: 'ORPHAN',
        oldValue: 'No matching Instructor record',
        newValue: profile.id,
      })
      continue
    }

    const fields: Array<string> = [
      'carMake', 'carModel', 'carYear', 'vehicleTypes', 'carImage',
      'vehicleRegistrationDoc', 'licenseNumber', 'licenseImageFront', 'licenseImageBack',
      'insuranceNumber', 'insurancePolicyDoc', 'policeCheckDoc', 'wwcCheckDoc',
      'certificationDoc', 'photoIdDoc', 'offersTestPackage', 'testPackageDuration',
      'testPackagePrice',
    ]

    for (const field of fields) {
      compare(
        'DrivingProviderProfile',
        profile.providerId,
        field,
        (instructor as any)[field],
        profile[field]
      )
    }

    // Date fields â€” compare as ISO strings
    for (const field of ['licenseExpiry', 'insuranceExpiry', 'policeCheckExpiry', 'wwcCheckExpiry'] as const) {
      const oldDate = (instructor as any)[field] ? new Date((instructor as any)[field]).toISOString() : null
      const newDate = profile[field] ? new Date(profile[field]).toISOString() : null
      compare('DrivingProviderProfile', profile.providerId, field, oldDate, newDate)
    }
  }

  // Check for instructors WITH driving data that DON'T have a profile record
  const instructorsWithDrivingData = await (prisma.provider as any).findMany({
    where: {
      OR: [
        { carMake: { not: null } },
        { licenseNumber: { not: null } },
        { wwcCheckDoc: { not: null } },
        { policeCheckDoc: { not: null } },
        { offersTestPackage: true },
      ],
    },
    select: { id: true, name: true },
  })

  for (const inst of instructorsWithDrivingData) {
    const hasProfile = profiles.some((p: any) => p.providerId === inst.id)
    if (!hasProfile) {
      mismatches.push({
        entity: 'DrivingProviderProfile',
        id: inst.id,
        field: 'MISSING_PROFILE',
        oldValue: `Instructor "${inst.name}" has driving data but no DrivingProviderProfile`,
        newValue: null,
      })
    }
  }
}

async function verifyLessonOutcomes() {
  console.log('\nâ”€â”€ DrivingLessonOutcome vs Booking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€')

  const outcomes = await (prisma as any).drivingLessonOutcome.findMany()
  console.log(`  Checking ${outcomes.length} DrivingLessonOutcome records...`)

  for (const outcome of outcomes) {
    const booking = await (prisma.booking as any).findUnique({
      where: { id: outcome.bookingId },
      select: {
        assessmentType: true, lessonTopics: true, passed: true,
        performanceScore: true, instructorNotes: true, whiteboardSketchUrl: true,
        lessonFeedback: true, studentStrengths: true, focusAreas: true,
      },
    })

    if (!booking) {
      mismatches.push({
        entity: 'DrivingLessonOutcome',
        id: outcome.bookingId,
        field: 'ORPHAN',
        oldValue: 'No matching Booking record',
        newValue: outcome.id,
      })
      continue
    }

    const scalarFields = [
      'assessmentType', 'lessonTopics', 'passed', 'performanceScore',
      'instructorNotes', 'whiteboardSketchUrl',
    ]
    for (const field of scalarFields) {
      compare('DrivingLessonOutcome', outcome.bookingId, field, (booking as any)[field], outcome[field])
    }

    // Array fields â€” sort before comparing
    const sortArr = (a: number[] | null | undefined) =>
      Array.isArray(a) ? [...a].sort((x, y) => x - y) : []

    for (const field of ['lessonFeedback', 'studentStrengths', 'focusAreas']) {
      const oldArr = sortArr((booking as any)[field])
      const newArr = sortArr(outcome[field])
      compare('DrivingLessonOutcome', outcome.bookingId, field, oldArr, newArr)
    }
  }
}

async function verifyReadPaths() {
  console.log('\nâ”€â”€ Read path verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€')
  console.log('  Confirming API routes call extension helpers...')

  // This is a static analysis check â€” we verify the source files contain
  // the right function calls rather than running the routes
  const { readFileSync, existsSync } = require('fs')
  const { join } = require('path')
  const root = join(__dirname, '..')

  const checks = [
    {
      file: 'app/api/instructor/documents/route.ts',
      must: ['getDrivingProfile'],
      mustNot: ['prisma.provider.findUnique.*wwcCheckDoc', 'prisma.provider.findUnique.*policeCheckDoc'],
    },
    {
      file: 'app/api/instructor/lesson-feedback/route.ts',
      must: ['getLessonOutcome', 'saveLessonOutcome'],
      mustNot: [],
    },
  ]

  for (const check of checks) {
    const path = join(root, check.file)
    if (!existsSync(path)) {
      console.log(`  âš ï¸  File not found: ${check.file}`)
      continue
    }
    const content = readFileSync(path, 'utf-8')
    for (const fn of check.must) {
      if (!content.includes(fn)) {
        mismatches.push({
          entity: 'ReadPath',
          id: check.file,
          field: 'MISSING_CALL',
          oldValue: `Expected call to ${fn}`,
          newValue: 'not found',
        } as any)}
    }
  }
}

async function main() {
  console.log('D4 Verification â€” Extension Table Data Integrity')
  console.log('='.repeat(60))
  console.log('Development copy only. Production is untouched.')
  console.log('='.repeat(60))

  await verifyProviderProfiles()
  await verifyLessonOutcomes()
  await verifyReadPaths()

  console.log('\nâ”€â”€ Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€')
  console.log(`  Fields checked:  ${checked}`)
  console.log(`  Mismatches:      ${mismatches.length}`)

  if (mismatches.length === 0) {
    console.log('\nâœ… D4 PASSED â€” zero mismatches.')
    console.log('   Extension tables match the legacy columns exactly.')
    console.log('   Safe to proceed to D5: remove fallback + dual-write code.')
  } else {
    console.log('\nâŒ D4 FAILED â€” mismatches found:\n')
    for (const m of mismatches) {
      console.log(`  [${m.entity}] id=${m.id} field=${m.field}`)
      console.log(`    old: ${JSON.stringify(m.oldValue)}`)
      console.log(`    new: ${JSON.stringify(m.newValue)}`)
    }
    console.log('\n  Fix these mismatches before proceeding to D5.')
    console.log('  Run: npx tsx scripts/migrate-driving-extension-data.ts')
    console.log('  Then re-run this script.')
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
