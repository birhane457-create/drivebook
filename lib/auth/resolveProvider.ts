/**
 * lib/auth/resolveProvider.ts
 *
 * Resolves the provider (Instructor) ID from a session.
 *
 * Phase 1: The DB column is still `User.providerId` but the session field
 * was renamed to `providerId`. Stale JWTs (created before the rename) may
 * have `providerId` but not `providerId`.
 *
 * This helper handles both cases:
 *   1. session!.user!.providerId is set   → use it directly
 *   2. session!.user!.providerId is null  → look up Instructor by userId
 *
 * Usage in API routes:
 *   const providerId = await resolveProviderId(session)
 *   if (!providerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 */

import { prisma } from '@/lib/prisma'

interface SessionUser {
  id: string
  role?: string
  providerId?: string | null
}

/**
 * Resolves the Instructor ID for the current session user.
 * Returns null if the user has no associated Instructor record.
 */
export async function resolveProviderId(
  session: { user: SessionUser } | null
): Promise<string | null> {
  if (!session?.user) return null

  // Fast path — JWT has the provider ID already
  if (session!.user!.providerId) return session!.user!.providerId

  // Fallback — look up by userId (handles stale JWTs and ADMIN accounts)
  try {
    const instructor = await prisma.provider.findFirst({
      where: { userId: session!.user!.id },
      select: { id: true },
    })
    return instructor?.id ?? null
  } catch {
    return null
  }
}
