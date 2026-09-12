import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verifying test users...\n')

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['admin@drivebook.com.au', 'instructor@drivebook.com.au']
      }
    },
    include: {
      provider: {
        include: {
          subscriptions: true
        }
      }
    }
  })

  if (users.length === 0) {
    console.log('❌ No test users found!')
    return
  }

  console.log(`✅ Found ${users.length} test user(s)\n`)

  users.forEach(user => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📧 ${user.email}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Name: ${user.name || 'N/A'}`)
    console.log(`   Email Verified: ${user.emailVerified ? '✅' : '❌'}`)
    
    if (user.provider) {
      console.log(`\n   Provider Details:`)
      console.log(`   ├─ ID: ${user.provider.id}`)
      console.log(`   ├─ Name: ${user.provider.name}`)
      console.log(`   ├─ Phone: ${user.provider.phone}`)
      console.log(`   ├─ Status: ${user.provider.approvalStatus}`)
      console.log(`   ├─ Active: ${user.provider.isActive ? '✅' : '❌'}`)
      console.log(`   ├─ Subscription: ${user.provider.subscriptionTier} (${user.provider.subscriptionStatus})`)
      console.log(`   ├─ Hourly Rate: $${user.provider.hourlyRate}`)
      console.log(`   ├─ Business Model: ${user.provider.businessModel}`)
      console.log(`   └─ Payment Mode: ${user.provider.paymentMode}`)
      
      if (user.provider.subscriptions && user.provider.subscriptions.length > 0) {
        console.log(`\n   Active Subscriptions: ${user.provider.subscriptions.length}`)
      }
    }
    console.log()
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('✅ Verification complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
