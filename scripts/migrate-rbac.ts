/**
 * RBAC Migration Script
 *
 * Populates StaffMember.permissions for all existing ADMIN users.
 * Idempotent — safe to run multiple times.
 *
 * Behaviour per RBAC-SPEC.md:
 *   - SUPER_ADMIN: untouched (wildcard, never reads permissions)
 *   - ADMIN with no StaffMember: creates one with ADMIN_PERMISSIONS preset
 *   - ADMIN with StaffMember + permissions=[]: populates with ADMIN_PERMISSIONS preset
 *   - ADMIN with StaffMember + permissions already set: skipped (no overwrite)
 *
 * Run: npx ts-node --project tsconfig.json scripts/migrate-rbac.ts
 *   or: node -r ts-node/register scripts/migrate-rbac.ts
 */

import { PrismaClient } from '@prisma/client'
import { ADMIN_PERMISSIONS } from '../lib/rbac/role-presets'

const prisma = new PrismaClient()

async function main() {
  console.log('[migrate-rbac] Starting RBAC permissions migration...\n')

  // Find all ADMIN users (not SUPER_ADMIN)
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      email: true,
      staffMember: {
        select: { id: true, permissions: true },
      },
    },
  })

  console.log(`[migrate-rbac] Found ${adminUsers.length} ADMIN user(s)\n`)

  let created = 0
  let populated = 0
  let skipped = 0

  for (const user of adminUsers) {
    if (!user.staffMember) {
      // Create StaffMember with ADMIN preset
      await prisma.staffMember.create({
        data: {
          userId: user.id,
          name: user.email,
          email: user.email,
          department: 'ADMIN',
          permissions: ADMIN_PERMISSIONS,
        },
      })
      console.log(`  [CREATED]  ${user.email} — no StaffMember, created with ADMIN preset (${ADMIN_PERMISSIONS.length} permissions)`)
      created++
    } else if (user.staffMember.permissions.length === 0) {
      // Populate empty permissions with ADMIN preset
      await prisma.staffMember.update({
        where: { id: user.staffMember.id },
        data: { permissions: ADMIN_PERMISSIONS },
      })
      console.log(`  [POPULATED] ${user.email} — permissions was empty, set to ADMIN preset (${ADMIN_PERMISSIONS.length} permissions)`)
      populated++
    } else {
      // Already has permissions — do not overwrite
      console.log(`  [SKIPPED]  ${user.email} — already has ${user.staffMember.permissions.length} permissions, not modified`)
      skipped++
    }
  }

  // Count SUPER_ADMIN (informational only — no action taken)
  const superAdminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } })
  console.log(`\n[migrate-rbac] SUPER_ADMIN accounts: ${superAdminCount} (untouched — wildcard access)`)

  console.log(`\n[migrate-rbac] Complete:`)
  console.log(`  Created  : ${created}`)
  console.log(`  Populated: ${populated}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Total    : ${adminUsers.length}`)
}

main()
  .catch((e) => {
    console.error('[migrate-rbac] Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
