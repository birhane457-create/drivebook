/**
 * Script to verify email for testing
 * Usage: node scripts/verify-email.mjs
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'birhane157@gmail.com'
  const newPassword = 'test123' // Simple test password
  
  console.log('🔍 Looking up user:', email)
  
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          approvalStatus: true,
        },
      },
    },
  })
  
  if (!user) {
    console.error('❌ User not found:', email)
    return
  }
  
  console.log('✅ User found:')
  console.log('   Email:', user.email)
  console.log('   Role:', user.role)
  console.log('   Email Verified:', user.emailVerified)
  console.log('   Provider ID:', user.provider?.id)
  console.log('   Provider Name:', user.provider?.name)
  console.log('   Approval Status:', user.provider?.approvalStatus)
  console.log('')
  
  // Verify email
  if (!user.emailVerified) {
    console.log('📧 Verifying email...')
    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    })
    console.log('✅ Email verified!')
  } else {
    console.log('✅ Email already verified')
  }
  
  // Reset password
  console.log(`🔐 Resetting password to: "${newPassword}"`)
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  })
  
  console.log('✅ Password reset complete!')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Login Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`   Email:    ${email}`)
  console.log(`   Password: ${newPassword}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('You can now log in at: http://localhost:3000/login')
}

main()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
