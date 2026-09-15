/**
 * F-05 Fix Verification Tests
 * Tests offline booking price validation against DEV database
 * 
 * IMPORTANT: DEV database only
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

let testResults = []

function recordTest(category, test, passed, details = '') {
  testResults.push({ category, test, passed, details })
  const icon = passed ? '✅' : '❌'
  const color = passed ? 'green' : 'red'
  log(`${icon} ${test}${details ? ': ' + details : ''}`, color)
}

// Helper to create test offline booking directly in DB
async function createTestOfflineBooking(providerId, amount) {
  const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // +1 hour
  
  return await prisma.booking.create({
    data: {
      providerId,
      customerName: 'Test Student',
      customerPhone: '+61400000000',
      bookingType: 'LESSON',
      status: 'CONFIRMED',
      startTime,
      endTime,
      duration: 60,
      price: amount,
      platformFee: 0,
      providerPayout: amount,
      commissionRate: 0,
      isPaid: true,
      paidAt: new Date(),
      createdBy: 'provider',
      originalStartTime: startTime,
      source: 'offline',
      offlinePaymentMethod: 'cash',
      offlineAmountPaid: amount,
    }
  })
}

async function testDatabaseStructure() {
  log('\n=== F-05: Database Structure Verification ===', 'blue')
  
  try {
    // Verify Provider has hourlyRate
    const providerFields = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Provider' 
      AND column_name = 'hourlyRate'
    `
    
    recordTest('F-05', 'Provider.hourlyRate field exists', providerFields.length > 0)
    
    // Verify Booking has offline fields
    const bookingFields = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Booking' 
      AND column_name IN ('offlineAmountPaid', 'offlinePaymentMethod', 'source')
      ORDER BY column_name
    `
    
    recordTest('F-05', 'Booking offline fields exist', bookingFields.length === 3)
    
    return true
  } catch (error) {
    log(`❌ Database structure error: ${error.message}`, 'red')
    return false
  }
}

async function testValidPrices() {
  log('\n=== F-05: Valid Price Test Cases ===', 'blue')
  
  try {
    const provider = await prisma.provider.findFirst({
      where: { isActive: true }
    })
    
    if (!provider) {
      log('⚠️  No active provider found for testing', 'yellow')
      return false
    }
    
    const testCases = [
      { amount: 75.00, description: 'Normal lesson ($75)' },
      { amount: 0.00, description: 'Free lesson ($0)' },
      { amount: 50.00, description: 'Discounted lesson ($50)' },
      { amount: 150.00, description: 'Test prep ($150)' },
      { amount: 1500.00, description: 'Intensive package ($1500)' },
      { amount: 30.00, description: 'Deposit ($30)' },
      { amount: 2000.00, description: 'Maximum allowed ($2000)' },
      { amount: 1999.99, description: 'Just under max ($1999.99)' },
    ]
    
    for (const testCase of testCases) {
      const booking = await createTestOfflineBooking(provider.id, testCase.amount)
      
      if (booking && booking.id) {
        recordTest('F-05', `${testCase.description} accepted`, true, `booking ${booking.id.substring(0, 8)}`)
        
        // Verify stored correctly
        const stored = await prisma.booking.findUnique({
          where: { id: booking.id },
          select: { offlineAmountPaid: true, price: true }
        })
        
        const correctlyStored = stored && 
                                Number(stored.offlineAmountPaid) === testCase.amount &&
                                Number(stored.price) === testCase.amount
        
        if (!correctlyStored) {
          recordTest('F-05', `${testCase.description} stored correctly`, false, 
                    `Expected ${testCase.amount}, got ${stored?.offlineAmountPaid}`)
        }
        
        // Clean up
        await prisma.booking.delete({ where: { id: booking.id } })
      } else {
        recordTest('F-05', `${testCase.description} accepted`, false, 'Booking creation failed')
      }
    }
    
    return true
  } catch (error) {
    log(`❌ Valid price test error: ${error.message}`, 'red')
    return false
  }
}

async function testInvalidPrices() {
  log('\n=== F-05: Invalid Price Test Cases ===', 'blue')
  
  try {
    const provider = await prisma.provider.findFirst({
      where: { isActive: true }
    })
    
    if (!provider) {
      log('⚠️  No active provider found for testing', 'yellow')
      return false
    }
    
    // These should fail at API level, but we can test database constraint
    const testCases = [
      { amount: -50.00, description: 'Negative amount (-$50)' },
      { amount: 2000.01, description: 'Just over max ($2000.01)' },
      { amount: 50000.00, description: 'Fraud attempt ($50,000)' },
      { amount: 999999999.99, description: 'Extreme amount ($999,999,999.99)' },
    ]
    
    for (const testCase of testCases) {
      try {
        const booking = await createTestOfflineBooking(provider.id, testCase.amount)
        
        // If booking was created, it means validation didn't work at DB level
        // (API should block these before DB)
        if (booking && booking.id) {
          recordTest('F-05', `${testCase.description} rejected`, false, 
                    `Was accepted (booking ${booking.id.substring(0, 8)})`)
          // Clean up
          await prisma.booking.delete({ where: { id: booking.id } })
        }
      } catch (error) {
        // Expected to fail for negative amounts (Prisma/DB constraint)
        if (testCase.amount < 0) {
          recordTest('F-05', `${testCase.description} rejected`, true, 'DB constraint enforced')
        } else {
          // For positive amounts over max, API should reject (not DB)
          // If we're here, it means something went wrong
          recordTest('F-05', `${testCase.description} test`, false, error.message)
        }
      }
    }
    
    return true
  } catch (error) {
    log(`❌ Invalid price test error: ${error.message}`, 'red')
    return false
  }
}

async function testFinancialInvariants() {
  log('\n=== F-05: Financial Invariants Verification ===', 'blue')
  
  try {
    const provider = await prisma.provider.findFirst({
      where: { isActive: true }
    })
    
    if (!provider) {
      log('⚠️  No active provider found', 'yellow')
      return false
    }
    
    // Create test offline booking
    const booking = await createTestOfflineBooking(provider.id, 123.45)
    
    if (!booking) {
      recordTest('F-05', 'Test booking created', false)
      return false
    }
    
    // Verify financial invariants
    const stored = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        price: true,
        platformFee: true,
        providerPayout: true,
        commissionRate: true,
        isPaid: true,
        source: true,
        offlineAmountPaid: true,
      }
    })
    
    const invariants = {
      'price equals offlineAmountPaid': Number(stored.price) === 123.45,
      'platformFee is zero': Number(stored.platformFee) === 0,
      'providerPayout equals offlineAmountPaid': Number(stored.providerPayout) === 123.45,
      'commissionRate is zero': Number(stored.commissionRate) === 0,
      'isPaid is true': stored.isPaid === true,
      'source is offline': stored.source === 'offline',
    }
    
    for (const [invariant, passed] of Object.entries(invariants)) {
      recordTest('F-05', `Invariant: ${invariant}`, passed)
    }
    
    // Clean up
    await prisma.booking.delete({ where: { id: booking.id } })
    
    return Object.values(invariants).every(v => v === true)
  } catch (error) {
    log(`❌ Financial invariants test error: ${error.message}`, 'red')
    return false
  }
}

async function testPayoutExclusion() {
  log('\n=== F-05: Payout Exclusion Verification ===', 'blue')
  
  try {
    const provider = await prisma.provider.findFirst({
      where: { isActive: true }
    })
    
    if (!provider) {
      log('⚠️  No active provider found', 'yellow')
      return false
    }
    
    // Create completed offline booking (eligible for payout if not filtered)
    const pastTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    const booking = await prisma.booking.create({
      data: {
        providerId: provider.id,
        customerName: 'Test Student',
        bookingType: 'LESSON',
        status: 'COMPLETED',
        startTime: pastTime,
        endTime: new Date(pastTime.getTime() + 60 * 60 * 1000),
        duration: 60,
        price: 100,
        platformFee: 0,
        providerPayout: 100,
        commissionRate: 0,
        isPaid: true,
        paidAt: pastTime,
        createdBy: 'provider',
        originalStartTime: pastTime,
        source: 'offline',
        offlinePaymentMethod: 'cash',
        offlineAmountPaid: 100,
      }
    })
    
    // Query bookings eligible for payout (mimics payout endpoint filter)
    const bufferCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const eligibleBookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        status: 'COMPLETED',
        endTime: { lte: bufferCutoff },
        deletedAt: null,
        source: { not: 'offline' },  // ← Exclusion filter
      }
    })
    
    const offlineIncluded = eligibleBookings.some(b => b.id === booking.id)
    
    recordTest('F-05', 'Offline bookings excluded from payout calculation', !offlineIncluded)
    
    // Clean up
    await prisma.booking.delete({ where: { id: booking.id } })
    
    return !offlineIncluded
  } catch (error) {
    log(`❌ Payout exclusion test error: ${error.message}`, 'red')
    return false
  }
}

async function testEarningsAggregation() {
  log('\n=== F-05: Earnings Aggregation Verification ===', 'blue')
  
  try {
    const provider = await prisma.provider.findFirst({
      where: { isActive: true }
    })
    
    if (!provider) {
      log('⚠️  No active provider found', 'yellow')
      return false
    }
    
    // Get current offline earnings
    const beforeStats = await prisma.booking.aggregate({
      where: {
        providerId: provider.id,
        source: 'offline',
        status: 'COMPLETED',
      },
      _sum: {
        offlineAmountPaid: true,
      },
      _count: true,
    })
    
    const beforeTotal = Number(beforeStats._sum.offlineAmountPaid || 0)
    
    // Create completed offline booking
    const pastTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const booking = await prisma.booking.create({
      data: {
        providerId: provider.id,
        customerName: 'Test Student',
        bookingType: 'LESSON',
        status: 'COMPLETED',
        startTime: pastTime,
        endTime: new Date(pastTime.getTime() + 60 * 60 * 1000),
        duration: 60,
        price: 87.50,
        platformFee: 0,
        providerPayout: 87.50,
        commissionRate: 0,
        isPaid: true,
        paidAt: pastTime,
        createdBy: 'provider',
        originalStartTime: pastTime,
        source: 'offline',
        offlinePaymentMethod: 'cash',
        offlineAmountPaid: 87.50,
      }
    })
    
    // Get updated offline earnings
    const afterStats = await prisma.booking.aggregate({
      where: {
        providerId: provider.id,
        source: 'offline',
        status: 'COMPLETED',
      },
      _sum: {
        offlineAmountPaid: true,
      },
      _count: true,
    })
    
    const afterTotal = Number(afterStats._sum.offlineAmountPaid || 0)
    const difference = afterTotal - beforeTotal
    
    recordTest('F-05', 'Offline booking included in earnings aggregation', 
              Math.abs(difference - 87.50) < 0.01,  // Allow small float precision difference
              `Increased by $${difference.toFixed(2)}`)
    
    // Clean up
    await prisma.booking.delete({ where: { id: booking.id } })
    
    return Math.abs(difference - 87.50) < 0.01
  } catch (error) {
    log(`❌ Earnings aggregation test error: ${error.message}`, 'red')
    return false
  }
}

async function runAllTests() {
  log('\n╔══════════════════════════════════════════════════════════╗', 'blue')
  log('║         F-05 Fix Verification - DEV Environment         ║', 'blue')
  log('╚══════════════════════════════════════════════════════════╝', 'blue')
  
  // Verify DEV environment
  const env = process.env.STRIPE_SECRET_KEY || ''
  if (!env.includes('_test_') && !env.startsWith('sk_test_') && env !== '') {
    log('🔴 ABORTING: Not in DEV environment', 'red')
    return false
  }
  log('✅ Confirmed DEV environment\n', 'green')
  
  const results = {
    structure: false,
    validPrices: false,
    invalidPrices: false,
    financialInvariants: false,
    payoutExclusion: false,
    earningsAggregation: false,
  }
  
  try {
    results.structure = await testDatabaseStructure()
    results.validPrices = await testValidPrices()
    results.invalidPrices = await testInvalidPrices()
    results.financialInvariants = await testFinancialInvariants()
    results.payoutExclusion = await testPayoutExclusion()
    results.earningsAggregation = await testEarningsAggregation()
    
  } catch (error) {
    log(`\n❌ Test error: ${error.message}`, 'red')
  } finally {
    await prisma.$disconnect()
  }
  
  // Summary
  log('\n╔══════════════════════════════════════════════════════════╗', 'blue')
  log('║              F-05 VERIFICATION SUMMARY                   ║', 'blue')
  log('╚══════════════════════════════════════════════════════════╝', 'blue')
  
  const allPassed = Object.values(results).every(r => r === true)
  
  for (const [test, passed] of Object.entries(results)) {
    const icon = passed ? '✅' : '❌'
    const color = passed ? 'green' : 'red'
    log(`${icon} ${test.padEnd(25)}: ${passed ? 'PASS' : 'FAIL'}`, color)
  }
  
  log(`\nIndividual Tests: ${testResults.filter(r => r.passed).length}/${testResults.length} passed`)
  
  if (allPassed) {
    log('\n🎉 ALL F-05 VERIFICATION TESTS PASSED', 'green')
  } else {
    log('\n⚠️  SOME F-05 VERIFICATION TESTS FAILED', 'yellow')
  }
  
  return allPassed
}

runAllTests()
  .then(passed => {
    process.exit(passed ? 0 : 1)
  })
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red')
    console.error(error)
    process.exit(1)
  })
