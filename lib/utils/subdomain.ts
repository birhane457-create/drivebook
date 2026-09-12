/**
 * lib/utils/subdomain.ts
 *
 * Subdomain and domain resolution utilities.
 *
 * Phase 1: resolves subdomains/custom domains to a providerId (Instructor.id).
 * Phase 2: will resolve to a businessId once the Business + Domain tables exist.
 *
 * All functions use generic terminology (provider, not instructor).
 */

/**
 * Extract subdomain from a hostname.
 * Returns null for bare domains, IP addresses, localhost without subdomain.
 */
export function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0]
  const parts = host.split('.')

  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null
  }

  if (parts.length <= 2) return null

  const subdomain = parts[0]
  if (subdomain === 'www') return null

  return subdomain
}

/** Returns true if the hostname has a custom subdomain. */
export function isCustomSubdomain(hostname: string): boolean {
  return extractSubdomain(hostname) !== null
}

/**
 * Resolve a subdomain slug to a provider ID.
 *
 * Phase 1: looks up Instructor by customSlug or id.
 * Phase 2: will look up Business by slug from a Business table.
 *
 * Returns null if no matching provider is found.
 */
export async function getProviderBySubdomain(subdomain: string): Promise<string | null> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const provider = await prisma.provider.findFirst({
      where: {
        OR: [
          { customSlug: subdomain },
          { id: subdomain },
        ],
      },
      select: { id: true },
    })
    return provider?.id ?? null
  } catch (error) {
    console.error('[subdomain] Error resolving provider by subdomain:', error)
    return null
  }
}

/**
 * @deprecated Use getProviderBySubdomain() instead.
 * Kept for backward compatibility during migration.
 */
export async function getInstructorBySubdomain(subdomain: string): Promise<string | null> {
  return getProviderBySubdomain(subdomain)
}

/**
 * Build the public booking URL for a provider.
 * Uses their custom subdomain if available, otherwise falls back to the
 * platform-hosted path.
 */
export function buildBookingUrl(providerId: string, subdomain?: string | null): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au'
  if (subdomain) {
    return `https://${subdomain}.${rootDomain}`
  }
  return `/book/${providerId}`
}
