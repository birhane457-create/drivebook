/**
 * Debug script to test login flow
 * Usage: node scripts/test-login-debug.mjs
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'birhane157@gmail.com'
  const password = 'test123'
  
  console.log('🔍 Testing login for:', email)
  console.log('')
  
  // Find user with all relations
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      provider: true,
    },
  })
  
  if (!user) {
    console.error('❌ User not found')
    return
  }
  
  console.log('✅ User found:')
  console.log('   ID:', user.id)
  console.log('   Email:', user.email)
  console.log('   Role:', user.role)
  console.log('   Email Verified:', user.emailVerified)
  console.log('   Has Password:', !!user.password)
  console.log('')
  
  // Test password
  if (user.password) {
    const isCorrect = await bcrypt.compare(password, user.password)
    console.log('🔐 Password check:')
    console.log('   Testing password:', password)
    console.log('   Result:', isCorrect ? '✅ CORRECT' : '❌ WRONG')
    console.log('')
  }
  
  // Check instructor/provider
  console.log('👤 Provider check:')
  console.log('   Has provider record:', !!user.provider)
  
  if (user.provider) {
    console.log('   Provider ID:', user.provider.id)
    console.log('   Provider Name:', user.provider.name)
    console.log('   Provider Status:', user.provider.approvalStatus)
  }
  
  console.log('')
  
  // Check approval status
  const status = user.provider?.approvalStatus
  console.log('📋 Approval check:')
  console.log('   Final status:', status)
  console.log('   Blocked?', status === 'SUSPENDED' || status === 'REJECTED' ? '❌ YES' : '✅ NO')
  console.log('')
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 LOGIN CHECK SUMMARY:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const checks = [
    { name: 'User exists', pass: !!user },
    { name: 'Has password', pass: !!user.password },
    { name: 'Email verified (for INSTRUCTOR)', pass: user.role !== 'INSTRUCTOR' || user.emailVerified },
    { name: 'Password correct', pass: user.password && await bcrypt.compare(password, user.password) },
    { name: 'Not suspended/rejected', pass: status !== 'SUSPENDED' && status !== 'REJECTED' },
  ]
  
  checks.forEach(check => {
    console.log(`   ${check.pass ? '✅' : '❌'} ${check.name}`)
  })
  
  const allPass = checks.every(c => c.pass)
  console.log('')
  console.log(allPass ? '✅ LOGIN SHOULD SUCCEED' : '❌ LOGIN WILL FAIL')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
