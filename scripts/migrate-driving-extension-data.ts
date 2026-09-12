/**
 * scripts/migrate-driving-extension-data.ts
 *
 * Phase 2B data migration.
 * Copies driving-specific fields from Instructor â†’ DrivingProviderProfile
 * and from Booking â†’ DrivingLessonOutcome.
 *
 * Safe to re-run (uses upsert). Does NOT delete the old columns.
 * Old columns are only removed in the next schema migration after
 * application code has been updated to read from the new tables.
 *
 * Run: npx tsx scripts/migrate-driving-extension-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Phase 2B: Migrating driving extension data\n')

  // â”€â”€ DrivingProviderProfile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('Step 1: Migrating Instructor â†’ DrivingProviderProfile...')

  const instructors = (await prisma.provider.findMany({
    select: {
      id: true, carYear: true, vehicleRegistrationDoc: true,
      licenseImageFront: true, licenseImageBack: true, insuranceExpiry: true, insurancePolicyDoc: true,
      policeCheckDoc: true, policeCheckExpiry: true,
      wwcCheckDoc: true, wwcCheckExpiry: true,
      certificationDoc: true, photoIdDoc: true,
    },
  } as any) as any[])

  let providerProfilesCreated = 0
  let providerProfilesSkipped = 0

  for (const inst of instructors) {
    // Only create a profile if the instructor has any driving-specific data
    const hasDrivingData =
      inst.carMake || inst.licenseNumber || inst.wwcCheckDoc ||
      inst.policeCheckDoc || inst.offersTestPackage || inst.vehicleRegistrationDoc

    if (!hasDrivingData) { providerProfilesSkipped++; continue }

    await (prisma as any).drivingProviderProfile.upsert({
      where: { providerId: inst.id },
      create: {
        preferredProviderId:            inst.id,
        carMake:               inst.carMake,
        carModel:              inst.carModel,
        carYear:               inst.carYear,
        vehicleTypes:          inst.vehicleTypes,
        carImage:              inst.carImage,
        vehicleRegistrationDoc: inst.vehicleRegistrationDoc,
        licenseNumber:         inst.licenseNumber,
        licenseExpiry:         inst.licenseExpiry,
        licenseImageFront:     inst.licenseImageFront,
        licenseImageBack:      inst.licenseImageBack,
        insuranceNumber:       inst.insuranceNumber,
        insuranceExpiry:       inst.insuranceExpiry,
        insurancePolicyDoc:    inst.insurancePolicyDoc,
        policeCheckDoc:        inst.policeCheckDoc,
        policeCheckExpiry:     inst.policeCheckExpiry,
        wwcCheckDoc:           inst.wwcCheckDoc,
        wwcCheckExpiry:        inst.wwcCheckExpiry,
        certificationDoc:      inst.certificationDoc,
        photoIdDoc:            inst.photoIdDoc,
        testPackageDuration:   inst.testPackageDuration,
        testPackageIncludes:   inst.testPackageIncludes as any,
      },
      update: {
        carMake:               inst.carMake,
        carModel:              inst.carModel,
        carYear:               inst.carYear,
        vehicleTypes:          inst.vehicleTypes,
        carImage:              inst.carImage,
        vehicleRegistrationDoc: inst.vehicleRegistrationDoc,
        licenseNumber:         inst.licenseNumber,
        licenseExpiry:         inst.licenseExpiry,
        licenseImageFront:     inst.licenseImageFront,
        licenseImageBack:      inst.licenseImageBack,
        insuranceNumber:       inst.insuranceNumber,
        insuranceExpiry:       inst.insuranceExpiry,
        insurancePolicyDoc:    inst.insurancePolicyDoc,
        policeCheckDoc:        inst.policeCheckDoc,
        policeCheckExpiry:     inst.policeCheckExpiry,
        wwcCheckDoc:           inst.wwcCheckDoc,
        wwcCheckExpiry:        inst.wwcCheckExpiry,
        certificationDoc:      inst.certificationDoc,
        photoIdDoc:            inst.photoIdDoc,
        testPackageDuration:   inst.testPackageDuration,
        testPackageIncludes:   inst.testPackageIncludes as any,
      },
    })
    providerProfilesCreated++
  }

  console.log(`  Created/updated: ${providerProfilesCreated}`)
  console.log(`  Skipped (no driving data): ${providerProfilesSkipped}`)

  // â”€â”€ DrivingLessonOutcome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nStep 2: Migrating Booking â†’ DrivingLessonOutcome...')

  // Only migrate bookings that have actual driving assessment data
  const bookings = await (prisma.booking as any).findMany({
    where: {
      OR: [
        { assessmentType: { not: 'COACHING' } },
        { lessonFeedback: { isEmpty: false } },
        { lessonTopics: { not: null } },
        { performanceScore: { not: null } },
        { instructorNotes: { not: null } },
        { whiteboardSketchUrl: { not: null } },
        { studentStrengths: { isEmpty: false } },
        { focusAreas: { isEmpty: false } },
      ],
    },
    select: {
      id: true,
      assessmentType: true,
      lessonTopics: true,
      passed: true,
      performanceScore: true,
      studentStrengths: true,
      focusAreas: true,
      lessonFeedback: true,
      instructorNotes: true,
      whiteboardSketchUrl: true,
      feedbackGivenAt: true,
    },
  })

  let outcomesMigrated = 0

  for (const booking of bookings) {
    await (prisma as any).drivingLessonOutcome.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId:          booking.id,
        assessmentType:     booking.assessmentType ?? 'COACHING',
        lessonTopics:       booking.lessonTopics,
        passed:             booking.passed,
        performanceScore:   booking.performanceScore,
        studentStrengths:   booking.studentStrengths ?? [],
        focusAreas:         booking.focusAreas ?? [],
        lessonFeedback:     booking.lessonFeedback ?? [],
        instructorNotes:    booking.instructorNotes,
        whiteboardSketchUrl: booking.whiteboardSketchUrl,
        feedbackGivenAt:    booking.feedbackGivenAt,
      },
      update: {
        assessmentType:     booking.assessmentType ?? 'COACHING',
        lessonTopics:       booking.lessonTopics,
        passed:             booking.passed,
        performanceScore:   booking.performanceScore,
        studentStrengths:   booking.studentStrengths ?? [],
        focusAreas:         booking.focusAreas ?? [],
        lessonFeedback:     booking.lessonFeedback ?? [],
        instructorNotes:    booking.instructorNotes,
        whiteboardSketchUrl: booking.whiteboardSketchUrl,
        feedbackGivenAt:    booking.feedbackGivenAt,
      },
    })
    outcomesMigrated++
    if (outcomesMigrated % 100 === 0) console.log(`  Migrated ${outcomesMigrated} outcomes...`)
  }

  console.log(`  Migrated: ${outcomesMigrated} lesson outcomes`)

  console.log('\nPhase 2B data migration complete.')
  console.log('Next step: Update application code to read from DrivingProviderProfile and DrivingLessonOutcome')
  console.log('Then: Remove old columns with the next schema migration')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
