/**
 * Check Session Debug Script
 * Helps debug login issues by checking what's in the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking provider user details...\n')

  const user = await prisma.user.findUnique({
    where: { email: 'instructor@drivebook.com.au' },
    include: {
      provider: {
        include: {
          subscriptions: true
        }
      }
    }
  })

  if (!user) {
    console.log('❌ User not found!')
    return
  }

  console.log('✅ User Found:')
  console.log('   ID:', user.id)
  console.log('   Email:', user.email)
  console.log('   Role:', user.role)
  console.log('   Email Verified:', user.emailVerified)
  console.log('   Provider ID:', user.providerId)
  console.log('')

  if (!user.provider) {
    console.log('❌ No provider record linked!')
    console.log('   This will cause dashboard access issues.')
    return
  }

  console.log('✅ Provider Record Found:')
  console.log('   ID:', user.provider.id)
  console.log('   Name:', user.provider.name)
  console.log('   Approval Status:', user.provider.approvalStatus)
  console.log('   Is Active:', user.provider.isActive)
  console.log('   Subscription Tier:', user.provider.subscriptionTier)
  console.log('   Subscription Status:', user.provider.subscriptionStatus)
  console.log('   Trial Ends At:', user.provider.trialEndsAt)
  console.log('')

  // Check if trial is expired
  if (user.provider.trialEndsAt) {
    const now = new Date()
    const trialEnd = new Date(user.provider.trialEndsAt)
    const isExpired = trialEnd < now
    console.log('   Trial Status:', isExpired ? '❌ EXPIRED' : '✅ ACTIVE')
    if (!isExpired) {
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
      console.log('   Days Remaining:', daysLeft)
    }
  }
  console.log('')

  // Check what the auth callback will return
  console.log('🔑 Auth Session Will Contain:')
  console.log('   id:', user.id)
  console.log('   email:', user.email)
  console.log('   role:', user.role)
  console.log('   providerId:', user.providerId ?? 'undefined')
  console.log('   businessType:', user.provider?.businessModel === 'MARKETPLACE' ? 'driving' : 'other')
  console.log('   paymentModel:', user.provider?.businessModel?.toLowerCase() === 'marketplace' ? 'marketplace' : 'saas')
  console.log('')

  // Check subscription access logic
  const subscriptionStatus = user.provider.subscriptionStatus
  const trialEndsAt = user.provider.trialEndsAt
  
  console.log('📊 Subscription Access Check:')
  if (subscriptionStatus === 'TRIAL') {
    const trialExpired = trialEndsAt && new Date(trialEndsAt) < new Date()
    if (!trialExpired) {
      console.log('   ✅ FULL ACCESS - Active trial, not expired')
    } else {
      console.log('   ⚠️  READ-ONLY - Trial expired')
    }
  } else if (subscriptionStatus === 'ACTIVE') {
    console.log('   ✅ FULL ACCESS - Active subscription')
  } else {
    console.log('   ⚠️  READ-ONLY - Subscription status:', subscriptionStatus)
  }
  console.log('')

  // Check dashboard layout logic
  console.log('🚪 Dashboard Access:')
  if (user.role === 'CLIENT') {
    console.log('   ❌ Will redirect to /client-dashboard')
  } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    console.log('   ❌ Will redirect to /admin')
  } else if (user.role === 'SUPERADMIN') {
    console.log('   ⚠️  Role is SUPERADMIN (no underscore) - might not match SUPER_ADMIN check!')
    console.log('   This could cause issues. Should be either "ADMIN" or "SUPER_ADMIN" with underscore.')
  } else if (user.role === 'provider') {
    console.log('   ✅ Will allow /dashboard access')
  } else {
    console.log('   ⚠️  Unknown role:', user.role)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
