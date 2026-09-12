/**
 * Fix Admin Role Script
 * Changes SUPERADMIN to SUPER_ADMIN (with underscore) to match layout checks
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing admin role...\n')

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@drivebook.com.au' }
  })

  if (!admin) {
    console.log('❌ Admin user not found!')
    return
  }

  console.log('Current role:', admin.role)

  if (admin.role === 'SUPERADMIN') {
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'SUPER_ADMIN' }
    })
    console.log('✅ Updated role to: SUPER_ADMIN (with underscore)')
  } else if (admin.role === 'SUPER_ADMIN') {
    console.log('✅ Role is already correct: SUPER_ADMIN')
  } else {
    console.log('⚠️  Unexpected role:', admin.role)
    console.log('   Updating to SUPER_ADMIN...')
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'SUPER_ADMIN' }
    })
    console.log('✅ Updated to: SUPER_ADMIN')
  }

  console.log('\n🎉 Done! Admin can now access /admin')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
