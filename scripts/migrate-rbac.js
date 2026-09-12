/**
 * RBAC Migration Script (CJS version)
 *
 * Populates StaffMember.permissions for all existing ADMIN users.
 * Idempotent — safe to run multiple times.
 *
 * Run: node scripts/migrate-rbac.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ADMIN preset — mirrors lib/rbac/role-presets.ts ADMIN_PERMISSIONS
const ADMIN_PERMISSIONS = [
  'users.instructors.view',
  'users.instructors.approve',
  'users.instructors.reject',
  'users.instructors.suspend',
  'users.instructors.send_email',
  'users.instructors.manage_subscription',
  'users.instructors.verify_documents',
  'users.instructors.verify_abn',
  'users.clients.view',
  'users.clients.edit',
  'users.clients.wallet_credit',
  'users.clients.reset_password',
  'users.subscriptions.view',
  'finance.revenue.view',
  'finance.payouts.view',
  'finance.credits.view',
  'finance.credits.manage',
  'finance.disputes.view',
  'finance.pricing.view',
  'operations.bookings.view',
  'operations.bookings.cancel',
  'operations.documents.view',
  'operations.documents.verify',
  'operations.test_centres.view',
  'operations.test_centres.manage',
  'operations.policy.view',
  'operations.audit_log.view',
  'operations.cron.view',
  'operations.voice_lines.view',
  'operations.voice_lines.manage',
  'engagement.reviews.view',
  'engagement.reviews.moderate',
  'engagement.support.view',
  'engagement.support.contact',
  'engagement.support.reset_password',
  'platform.settings.view',
  'platform.copilot.view',
]

async function main() {
  console.log('[migrate-rbac] Starting RBAC permissions migration...\n')

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
      await prisma.staffMember.create({
        data: {
          userId: user.id,
          name: user.email,
          email: user.email,
          department: 'ADMIN',
          permissions: ADMIN_PERMISSIONS,
        },
      })
      console.log(`  [CREATED]   ${user.email} — created StaffMember with ADMIN preset (${ADMIN_PERMISSIONS.length} permissions)`)
      created++
    } else if (user.staffMember.permissions.length === 0) {
      await prisma.staffMember.update({
        where: { id: user.staffMember.id },
        data: { permissions: ADMIN_PERMISSIONS },
      })
      console.log(`  [POPULATED] ${user.email} — permissions was empty, set to ADMIN preset (${ADMIN_PERMISSIONS.length} permissions)`)
      populated++
    } else {
      console.log(`  [SKIPPED]   ${user.email} — already has ${user.staffMember.permissions.length} permissions`)
      skipped++
    }
  }

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
  .finally(() => prisma.$disconnect())
