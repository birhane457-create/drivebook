/**
 * Bulk migration: instructor → provider model rename
 * Fixes all remaining TypeScript errors from the Instructor→Provider schema migration.
 *
 * Safe to run multiple times (idempotent replacements).
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')   // strip leading slash on Windows drive letter
  .replace(/%20/g, ' ')            // decode spaces
  .replace(/\//g, '\\')            // normalise to backslashes
  .replace(/\\$/, '')              // strip trailing slash

// ── Replacement rules (order matters — more specific first) ──────────────────

const REPLACEMENTS = [
  // Prisma model references
  ['prisma.instructor.', 'prisma.provider.'],
  ['prisma.client.', 'prisma.customer.'],

  // Booking field names
  ['instructorId:', 'providerId:'],
  ['clientId:', 'customerId:'],
  ['instructorPayout:', 'providerPayout:'],
  ['"instructorId"', '"providerId"'],
  ['"clientId"', '"customerId"'],
  ['"instructorPayout"', '"providerPayout"'],

  // Local variable / type property names (instructorId → providerId)
  ['instructorId }', 'providerId }'],
  ['instructorId,', 'providerId,'],
  ['instructorId)', 'providerId)'],
  ['instructorId\n', 'providerId\n'],
  ['const instructorId', 'const providerId'],
  ['let instructorId', 'let providerId'],
  ['{ instructorId }', '{ providerId }'],
  ['(instructorId)', '(providerId)'],
  ['.instructorId', '.providerId'],
  ['instructorId ===', 'providerId ==='],
  ['instructorId !==', 'providerId !=='],

  // ComplianceRecord / custom type field renames
  ['instructorId?:', 'providerId?:'],

  // BookingInclude / BookingSelect relation names
  ['include: { instructor', 'include: { provider'],
  ['include: { client', 'include: { customer'],
  ['select: { instructor', 'select: { provider'],
  ['select: { client:', 'select: { customer:'],
  ["include:{ instructor", "include:{ provider"],
  ["include:{ client", "include:{ customer"],

  // Booking result property access
  ['.instructor?.', '.provider?.'],
  ['.client?.', '.customer?.'],
  ['.instructor.', '.provider.'],
  ['.client.', '.customer.'],
  ['booking.instructor', 'booking.provider'],
  ['booking.client', 'booking.customer'],

  // ClientName / ClientPhone → CustomerName / CustomerPhone (Booking fields)
  ['clientName:', 'customerName:'],
  ['clientPhone:', 'customerPhone:'],
  ['.clientName', '.customerName'],
  ['.clientPhone', '.customerPhone'],
  ["'clientName'", "'customerName'"],
  ["'clientPhone'", "'customerPhone'"],

  // Permission constant renames
  ['USERS_INSTRUCTORS_VIEW', 'USERS_PROVIDERS_VIEW'],
  ['USERS_CLIENTS_VIEW', 'USERS_CUSTOMERS_VIEW'],
  ['USERS_CLIENTS_EDIT', 'USERS_CUSTOMERS_EDIT'],
  ['USERS_CLIENTS_WALLET_DEDUCT', 'USERS_CUSTOMERS_WALLET_DEDUCT'],
  ['USERS_CLIENTS_WALLET_ADD', 'USERS_CUSTOMERS_WALLET_ADD'],

  // User relation (User has 'customers' not 'clients')
  ['user.clients', 'user.customers'],
  ["include: { clients", "include: { customers"],
  ["select: { clients", "select: { customers"],
  ['.clients?', '.customers?'],
  ['.clients.', '.customers.'],

  // Payout model field
  ['payout.instructorId', 'payout.providerId'],

  // Transaction model field
  ['transaction.instructorId', 'transaction.providerId'],
  ['transactions.instructorId', 'transactions.providerId'],
]

// ── Files/dirs to skip ───────────────────────────────────────────────────────

const SKIP_PATHS = new Set([
  'node_modules',
  '.next',
  '.git',
  'prisma',           // schema managed separately
  'scripts',          // don't self-modify
  'drivebook-hybrid', // legacy separate app
  '.kiro',
])

const SKIP_FILES = new Set([
  // Extension files — they legitimately reference driving-specific models
  'lib/extensions/driving/providerProfile.ts',
  'lib/extensions/driving/index.ts',
  'lib/extensions/driving/payment-extension.ts',
  // Core resolver — already correct
  'lib/core/getProviderProfile.ts',
  // Already fixed
  'app/api/register/route.ts',
  'app/dashboard/page.tsx',
  'app/api/instructor/profile/route.ts',
  'app/api/instructor/settings/route.ts',
  'app/subdomain/[slug]/page.tsx',
])

// ── Walk & fix ───────────────────────────────────────────────────────────────

let totalFiles = 0
let fixedFiles = 0

function walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }

  for (const entry of entries) {
    if (SKIP_PATHS.has(entry)) continue

    const fullPath = join(dir, entry)
    let stat
    try { stat = statSync(fullPath) } catch { continue }

    if (stat.isDirectory()) {
      walk(fullPath)
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      const rel = fullPath.replace(ROOT + '\\', '').replace(/\\/g, '/')
      if (SKIP_FILES.has(rel)) continue
      fixFile(fullPath, rel)
    }
  }
}

function fixFile(path, rel) {
  let content
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    console.warn(`  ⚠ Cannot read: ${rel}`)
    return
  }

  const original = content

  for (const [from, to] of REPLACEMENTS) {
    // Simple global string replace — safe for these patterns
    while (content.includes(from)) {
      content = content.split(from).join(to)
    }
  }

  totalFiles++

  if (content !== original) {
    try {
      writeFileSync(path, content, 'utf8')
      fixedFiles++
      console.log(`  ✓ ${rel}`)
    } catch (e) {
      console.warn(`  ✗ Cannot write: ${rel} — ${e.message}`)
    }
  }
}

console.log(`\nBulk migration: instructor → provider\n`)
console.log(`Root: ${ROOT}\n`)

walk(ROOT)

console.log(`\n─────────────────────────────────────`)
console.log(`Scanned: ${totalFiles} TypeScript files`)
console.log(`Fixed:   ${fixedFiles} files`)
console.log(`\nNext: npx prisma generate && npx tsc --noEmit\n`)
