/**
 * lib/config/platform-identity.ts
 *
 * DEPRECATED — do not add new imports of this file.
 *
 * Identity is now resolved at runtime from BusinessConfig so that white-label
 * tenants see their own name, not "DriveBook", in emails, invoices and footers.
 *
 * Migration path:
 *   OLD:  import { PLATFORM_IDENTITY } from '@/lib/config/platform-identity'
 *   NEW:  import { getPlatformIdentity } from '@/lib/core/business-config'
 *         const identity = await getPlatformIdentity({ providerId })
 *
 * The static constants below are kept temporarily so existing call sites
 * continue to compile during the migration. They read from env vars so
 * at least the platform name is configurable without a code change.
 *
 * TODO (Phase 2): Remove this file entirely once all call sites are migrated.
 */

/** @deprecated Use getPlatformIdentity() from lib/core/business-config instead */
export const PLATFORM_IDENTITY = {
  name: process.env.PLATFORM_NAME ?? 'DriveBook',
  legalName: process.env.PLATFORM_LEGAL_NAME ?? 'DriveBook Pty Ltd',
  abn: process.env.PLATFORM_ABN ?? '23 806 069 420',
  email: process.env.ADMIN_EMAIL ?? 'support@drivebook.com.au',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@drivebook.com.au',
  website: process.env.NEXT_PUBLIC_SITE_URL ?? 'drivebook.com.au',
  baseUrl: process.env.NEXTAUTH_URL ?? 'https://drivebook.com.au',
} as const

/** @deprecated Use getPlatformIdentity() from lib/core/business-config instead */
export const PLATFORM_INVOICE_BLOCK = {
  name: PLATFORM_IDENTITY.name,
  email: PLATFORM_IDENTITY.email,
  website: PLATFORM_IDENTITY.website,
  abn: PLATFORM_IDENTITY.abn,
} as const
