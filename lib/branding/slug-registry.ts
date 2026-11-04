/**
 * lib/branding/slug-registry.ts
 *
 * WLA-014-SLUG: Global slug registry for cross-table uniqueness enforcement.
 *
 * Provider.customSlug and BusinessBranding.customSlug have independent @unique
 * indexes but no cross-table constraint. A concurrent request from each route
 * could both pass application-level availability checks and claim the same slug
 * in different tables (check-then-write race).
 *
 * The SlugRegistry table provides a single cross-table DB unique constraint on
 * slug. All slug claims are registered here atomically inside the write
 * transaction, making the race impossible at the database level.
 *
 * Usage pattern:
 *   - When writing a new slug: call claimSlug() inside the write transaction
 *   - When updating a slug: call releaseSlug() for the old slug, then claimSlug()
 *   - When deleting a slug: call releaseSlug()
 *
 * If claimSlug() throws P2002, return 409 to the client.
 */

import type { Prisma } from '@prisma/client'

export type SlugOwnerType = 'provider' | 'businessBranding'

/**
 * Claim a slug in the registry within an existing transaction.
 * Throws PrismaClientKnownRequestError (P2002) if the slug is already taken
 * by any owner (Provider or BusinessBranding).
 *
 * Must be called inside a prisma.$transaction() to ensure atomicity with the
 * owner record write.
 */
export async function claimSlug(
  tx: Prisma.TransactionClient,
  slug: string,
  ownerType: SlugOwnerType,
  ownerId: string
): Promise<void> {
  await (tx as any).slugRegistry.create({
    data: {
      slug,
      ownerType,
      ownerId,
    },
  })
}

/**
 * Release a slug from the registry within an existing transaction.
 * Safe to call even if the slug is not registered (no-op on missing records).
 *
 * Must be called inside a prisma.$transaction() alongside the owner record update.
 */
export async function releaseSlug(
  tx: Prisma.TransactionClient,
  ownerType: SlugOwnerType,
  ownerId: string
): Promise<void> {
  await (tx as any).slugRegistry.deleteMany({
    where: { ownerType, ownerId },
  })
}

/**
 * Update a slug claim atomically: release the old slug and claim the new one.
 * If newSlug is null, only releases the old slug.
 * If oldSlug is null, only claims the new slug.
 *
 * Must be called inside a prisma.$transaction().
 * Throws P2002 if newSlug is already taken.
 */
export async function updateSlugClaim(
  tx: Prisma.TransactionClient,
  ownerType: SlugOwnerType,
  ownerId: string,
  oldSlug: string | null,
  newSlug: string | null
): Promise<void> {
  if (oldSlug === newSlug) return  // no change

  if (oldSlug !== null) {
    await releaseSlug(tx, ownerType, ownerId)
  }
  if (newSlug !== null) {
    await claimSlug(tx, newSlug, ownerType, ownerId)
  }
}
