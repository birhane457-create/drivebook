/**
 * lib/extensions/driving/providerProfile.ts
 *
 * Helpers for reading and writing driving-specific provider profile data.
 * Reads exclusively from DrivingProviderProfile (Phase 2B table).
 *
 * D6 complete: fallback to Instructor columns removed.
 * D7 pending: legacy Instructor columns will be dropped via migration.
 */

import { prisma } from '@/lib/prisma'

export interface DrivingProfile {
  // Vehicle
  carMake:                string | null
  carModel:               string | null
  carYear:                string | null
  vehicleTypes:           string | null
  carImage:               string | null
  vehicleRegistrationDoc: string | null
  // Regulatory docs
  licenseNumber:          string | null
  licenseExpiry:          Date | null
  licenseImageFront:      string | null
  licenseImageBack:       string | null
  insuranceNumber:        string | null
  insuranceExpiry:        Date | null
  insurancePolicyDoc:     string | null
  policeCheckDoc:         string | null
  policeCheckExpiry:      Date | null
  wwcCheckDoc:            string | null
  wwcCheckExpiry:         Date | null
  certificationDoc:       string | null
  photoIdDoc:             string | null
  // PDA package
  offersTestPackage:      boolean
  testPackageDuration:    number | null
  testPackageIncludes:    unknown
  testPackagePrice:       number | null
}

/**
 * Get the driving profile for a provider.
 * Reads from DrivingProviderProfile. Returns null if no profile exists.
 */
export async function getDrivingProfile(providerId: string): Promise<DrivingProfile | null> {
  try {
    const profile = await (prisma as any).drivingProviderProfile.findUnique({
      where: { providerId },
    })
    return profile as DrivingProfile | null
  } catch {
    return null
  }
}

/**
 * Merge driving profile fields into an existing instructor record shape.
 * API response shape stays identical — UI doesn't need to know data moved.
 *
 * If no DrivingProviderProfile record exists yet (e.g. pre-migration instructor),
 * returns the instructor unchanged (fields will be null/undefined).
 */
export async function mergeDrivingProfile<T extends Record<string, unknown>>(
  instructorId: string,
  instructor: T
): Promise<T> {
  const profile = await getDrivingProfile(instructorId)
  if (!profile) return instructor

  const drivingFields = [
    'carMake', 'carModel', 'carYear', 'vehicleTypes', 'carImage',
    'vehicleRegistrationDoc', 'licenseNumber', 'licenseExpiry',
    'licenseImageFront', 'licenseImageBack', 'insuranceNumber', 'insuranceExpiry',
    'insurancePolicyDoc', 'policeCheckDoc', 'policeCheckExpiry',
    'wwcCheckDoc', 'wwcCheckExpiry', 'certificationDoc', 'photoIdDoc',
    'offersTestPackage', 'testPackageDuration', 'testPackageIncludes', 'testPackagePrice',
  ] as const

  const merged = { ...instructor }
  for (const field of drivingFields) {
    if (profile[field as keyof DrivingProfile] !== undefined) {
      ;(merged as any)[field] = profile[field as keyof DrivingProfile]
    }
  }
  return merged as T
}

/**
 * Write driving-specific fields to DrivingProviderProfile.
 * D6: no longer dual-writes to Instructor columns.
 */
export async function upsertDrivingProfile(
  providerId: string,
  data: Partial<DrivingProfile>
): Promise<void> {
  try {
    await (prisma as any).drivingProviderProfile.upsert({
      where: { providerId },
      create: { providerId, ...data },
      update: data,
    })
  } catch (e) {
    console.error('[upsertDrivingProfile] Failed to upsert extension record:', e)
  }
}
