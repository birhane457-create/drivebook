/**
 * Register Test Users Script
 * Creates a Super Admin and a Provider for testing
 * Run with: node scripts/register-test-users.mjs
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting user registration...\n')

  // 1. Register Super Admin
  console.log('📋 Creating Super Admin...')
  const adminEmail = 'admin@drivebook.com.au'
  const adminPassword = 'Admin123!'
  
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:', adminEmail)
      console.log('   User ID:', existingAdmin.id)
      console.log('   Role:', existingAdmin.role)
    } else {
      const hashedAdminPassword = await bcrypt.hash(adminPassword, 10)
      
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedAdminPassword,
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        }
      })

      console.log('✅ Super Admin created successfully!')
      console.log('   Email:', adminEmail)
      console.log('   Password:', adminPassword)
      console.log('   User ID:', admin.id)
      console.log('   Role:', admin.role)
    }
  } catch (error) {
    console.error('❌ Error creating admin:', error)
  }

  console.log('\n---\n')

  // 2. Register Provider (Driving Instructor)
  console.log('📋 Creating Provider (Driving Instructor)...')
  const providerEmail = 'instructor@drivebook.com.au'
  const providerPassword = 'Provider123!'
  const providerName = 'John Smith'
  const providerPhone = '+61412345678'

  try {
    // Check if provider already exists
    const existingProvider = await prisma.user.findUnique({
      where: { email: providerEmail },
      include: { provider: true }
    })

    if (existingProvider) {
      console.log('⚠️  Provider user already exists:', providerEmail)
      console.log('   User ID:', existingProvider.id)
      if (existingProvider.provider) {
        console.log('   Provider ID:', existingProvider.provider.id)
        console.log('   Name:', existingProvider.provider.name)
        console.log('   Status:', existingProvider.provider.approvalStatus)
      }
    } else {
      const hashedProviderPassword = await bcrypt.hash(providerPassword, 10)
      
      // Create in transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create User
        const user = await tx.user.create({
          data: {
            email: providerEmail,
            password: hashedProviderPassword,
            name: providerName,
            role: 'provider',
            emailVerified: true,
            emailVerifiedAt: new Date(),
            termsAcceptedAt: new Date(),
            termsVersion: '1.0',
            ageDeclaration: true,
          }
        })

        // 2. Create Provider
        const provider = await tx.provider.create({
          data: {
            user: {
              connect: { id: user.id }
            },
            name: providerName,
            phone: providerPhone,
            businessModel: 'MARKETPLACE',
            paymentMode: 'PLATFORM',
            accountType: 'INDIVIDUAL',
            hourlyRate: 65,
            baseAddress: 'Sydney CBD, NSW 2000',
            serviceRadiusKm: 20,
            languages: 'English',
            approvalStatus: 'APPROVED',
            isActive: true,
            isVerified: true,
          }
        })

        // 3. Link user to provider
        await tx.user.update({
          where: { id: user.id },
          data: { providerId: provider.id }
        })

        // 4. Set up subscription (14-day trial)
        const trialDays = 14
        const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

        await tx.provider.update({
          where: { id: provider.id },
          data: {
            subscriptionTier: 'PRO',
            subscriptionStatus: 'TRIAL',
            trialEndsAt,
          }
        })

        await tx.subscription.create({
          data: {
            provider: { connect: { id: provider.id } },
            tier: 'PRO',
            status: 'TRIAL',
            monthlyAmount: 0,
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
            trialEndsAt,
          }
        })

        return { user, provider }
      })

      console.log('✅ Provider created successfully!')
      console.log('   Email:', providerEmail)
      console.log('   Password:', providerPassword)
      console.log('   User ID:', result.user.id)
      console.log('   Provider ID:', result.provider.id)
      console.log('   Name:', result.provider.name)
      console.log('   Phone:', result.provider.phone)
      console.log('   Subscription:', 'PRO (Trial)')
      console.log('   Status:', 'APPROVED & ACTIVE')
    }
  } catch (error) {
    console.error('❌ Error creating provider:', error)
  }

  console.log('\n---\n')
  console.log('✅ Registration complete!')
  console.log('\n🔗 Login URLs:')
  console.log('   Frontend: http://localhost:3000/login')
  console.log('   Admin: http://localhost:3000/admin')
  console.log('\n📝 Test Credentials:\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔐 Super Admin:')
  console.log('   Email:    ', adminEmail)
  console.log('   Password: ', adminPassword)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👤 Provider (Instructor):')
  console.log('   Email:    ', providerEmail)
  console.log('   Password: ', providerPassword)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('🎉 Done!')
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
