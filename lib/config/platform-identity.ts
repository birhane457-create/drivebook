// lib/config/platform-identity.ts
//
// Single source of truth for DriveBook's legal and contact identity.
// Used by invoice generation, email footers, and terms pages.
// Update here only — do not hardcode in individual routes.

export const PLATFORM_IDENTITY = {
  name: 'DriveBook',
  legalName: 'DriveBook Pty Ltd',
  abn: '23 806 069 420',
  email: 'support@drivebook.com.au',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@drivebook.com.au',
  website: 'drivebook.com.au',
  baseUrl: process.env.NEXTAUTH_URL ?? 'https://drivebook.com.au',
} as const

/** Platform block used in InvoiceLayout data prop */
export const PLATFORM_INVOICE_BLOCK = {
  name: PLATFORM_IDENTITY.name,
  email: PLATFORM_IDENTITY.email,
  website: PLATFORM_IDENTITY.website,
  abn: PLATFORM_IDENTITY.abn,
} as const
