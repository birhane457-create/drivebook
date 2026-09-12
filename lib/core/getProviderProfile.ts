/**
 * lib/core/getProviderProfile.ts
 *
 * Extension boundary resolver — the single place where generic core code
 * hands off to the driving domain extension.
 *
 * ARCHITECTURE RULE (locked):
 *   Generic core code must never import mergeDrivingProfile() directly.
 *   Call getProviderProfile() instead. It resolves the correct extension
 *   based on provider.industry and returns a merged profile.
 *
 *   Driving-only entry points (e.g. /api/instructors/search, /api/pda-tests)
 *   may still import mergeDrivingProfile() directly — they are explicitly
 *   driving-aware by design.
 */

import { prisma } from '@/lib/prisma'

export type ProviderCore = {
  id: string
  industry?: string | null
  businessModel?: string | null
  [key: string]: unknown
}

/**
 * Resolve a full provider profile, merging domain-specific extension fields
 * if applicable.
 *
 * - Driving providers: merges DrivingProviderProfile fields (vehicles, licences, PDA)
 *   Detected by: industry === 'driving'  OR  businessModel === 'MARKETPLACE'
 * - All other providers: returns the provider record unchanged
 *
 * Usage (generic core code):
 *   const profile = await getProviderProfile(provider)
 *   // profile.vehicleTypes exists for driving, undefined for others — always safe to access
 */
export async function getProviderProfile<T extends ProviderCore>(
  provider: T
): Promise<T & Record<string, unknown>> {
  const isDriving =
    provider.industry === 'driving' ||
    provider.businessModel === 'MARKETPLACE'

  if (isDriving) {
    const { mergeDrivingProfile } = await import(
      '@/lib/extensions/driving/providerProfile'
    )
    return mergeDrivingProfile(provider.id, provider) as Promise<T & Record<string, unknown>>
  }
  // Non-driving: return as-is — no extension fields
  return provider as T & Record<string, unknown>
}

/**
 * Convenience: fetch a provider by id and resolve its full profile in one call.
 *
 * Usage:
 *   const profile = await fetchProviderProfile(providerId)
 */
export async function fetchProviderProfile(
  providerId: string,
  select?: Record<string, boolean>
): Promise<Record<string, unknown> | null> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    ...(select ? { select } : {}),
  })

  if (!provider) return null

  return getProviderProfile(provider as ProviderCore)
}
