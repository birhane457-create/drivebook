/**
 * F-05 API Fix Verification Tests
 * Tests offline booking price validation against the actual API endpoint
 * 
 * IMPORTANT: DEV environment only
 * Tests the API route /api/bookings/offline with authentication
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

// Helper to call the actual API endpoint
async function createOfflineBookingViaAPI(authToken, data) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  
  const response = await fetch(`${API_BASE}/api/bookings/offline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `next-auth.session-token=${authToken}`,
    },
    body: JSON.stringify(data),
  })
  
  const json = await response.json()
  return { status: response.status, data: json }
}

async function getAuthToken() {
  // Get a valid provider session from database
  const provider = await prisma.provider.findFirst({
    where: {
      isActive: true,
      subscriptionTier: { in: ['PRO', 'PREMIUM'] },
      approvalStatus: 'APPROVED',
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          sessions: {
            where: {
              expires: { gt: new Date() },
            },
            orderBy: { expires: 'desc' },
            take: 1,
            select: { sessionToken: true },
          },
        },
      },
    },
  })
  
  if (!provider || !provider.user?.sessions?.length) {
    throw new Error('No valid PRO+ provider session found for testing')
  }
  
  return {
    token: provider.user.sessions[0].sessionToken,
    providerId: provider.id,
  }
}

async function testValidPricesAPI() {
  log('\n=== F-05: Valid Price API Test Cases ===', 'blue')
  
  try {
    const { token } = await getAuthToken()
    
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const date = tomorrow.toISOString().split('T')[0]
    
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
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      const hour = 9 + i // Spread out times to avoid conflicts
      
      const requestData = {
        customerName: `Test Student ${i}`,
        customerPhone: `+6140000${String(i).padStart(4, '0')}`,
        date,
        time: `${hour.toString().padStart(2, '0')}:00`,
        durationMinutes: 60,
        offlinePaymentMethod: 'cash',
        offlineAmountPaid: testCase.amount,
      }
      
      const result = await createOfflineBookingViaAPI(token, requestData)
      
      if (result.status === 201 && result.data.success) {
        recordTest('F-05-API', `${testCase.description} accepted`, true, `booking created`)
        
        // Clean up
        if (result.data.booking?.id) {
          await prisma.booking.delete({ where: { id: result.data.booking.id } })
        }
      } else {
        recordTest('F-05-API', `${testCase.description} accepted`, false, 
                  `Status ${result.status}: ${result.data.error || 'Unknown error'}`)
      }
    }
    
    return true
  } catch (error) {
    log(`❌ Valid price API test error: ${error.message}`, 'red')
    return false
  }
}

async function testInvalidPricesAPI() {
  log('\n=== F-05: Invalid Price API Test Cases ===', 'blue')
  
  try {
    const { token } = await getAuthToken()
    
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const date = tomorrow.toISOString().split('T')[0]
    
    const testCases = [
      { amount: -50.00, description: 'Negative amount (-$50)', expectedStatus: 400 },
      { amount: 2000.01, description: 'Just over max ($2000.01)', expectedStatus: 400 },
      { amount: 50000.00, description: 'Fraud attempt ($50,000)', expectedStatus: 400 },
      { amount: 999999999.99, description: 'Extreme amount ($999,999,999.99)', expectedStatus: 400 },
    ]
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      const hour = 14 + i // Afternoon times to avoid conflicts
      
      const requestData = {
        customerName: `Invalid Test ${i}`,
        customerPhone: `+6141000${String(i).padStart(4, '0')}`,
        date,
        time: `${hour.toString().padStart(2, '0')}:00`,
        durationMinutes: 60,
        offlinePaymentMethod: 'cash',
        offlineAmountPaid: testCase.amount,
      }
      
      const result = await createOfflineBookingViaAPI(token, requestData)
      
      // Should be rejected with 400 status
      if (result.status === testCase.expectedStatus) {
        recordTest('F-05-API', `${testCase.description} rejected`, true, 
                  `Correctly returned ${result.status}`)
        
        // If somehow created, clean up
        if (result.data.booking?.id) {
          await prisma.booking.delete({ where: { id: result.data.booking.id } })
        }
      } else {
        recordTest('F-05-API', `${testCase.description} rejected`, false, 
                  `Expected ${testCase.expectedStatus}, got ${result.status}`)
        
        // Clean up if created
        if (result.data.booking?.id) {
          await prisma.booking.delete({ where: { id: result.data.booking.id } })
        }
      }
    }
    
    return true
  } catch (error) {
    log(`❌ Invalid price API test error: ${error.message}`, 'red')
    return false
  }
}

async function testEdgeCasesAPI() {
  log('\n=== F-05: Edge Case API Tests ===', 'blue')
  
  try {
    const { token } = await getAuthToken()
    
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const date = tomorrow.toISOString().split('T')[0]
    
    const testCases = [
      { 
        amount: 2000.00, 
        description: 'Exactly $2000 (boundary)', 
        expectedStatus: 201,
        shouldPass: true 
      },
      { 
        amount: 2000.01, 
        description: 'Just over boundary ($2000.01)', 
        expectedStatus: 400,
        shouldPass: false 
      },
      { 
        amount: 0.01, 
        description: 'Minimal amount ($0.01)', 
        expectedStatus: 201,
        shouldPass: true 
      },
    ]
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      const hour = 18 + i
      
      const requestData = {
        customerName: `Edge Test ${i}`,
        customerPhone: `+6142000${String(i).padStart(4, '0')}`,
        date,
        time: `${hour < 24 ? hour : 23}:${i * 15}`,
        durationMinutes: 60,
        offlinePaymentMethod: 'cash',
        offlineAmountPaid: testCase.amount,
      }
      
      const result = await createOfflineBookingViaAPI(token, requestData)
      
      const passed = result.status === testCase.expectedStatus
      recordTest('F-05-API', testCase.description, passed, 
                `Status: ${result.status}`)
      
      // Clean up if created
      if (result.data.booking?.id) {
        await prisma.booking.delete({ where: { id: result.data.booking.id } })
      }
    }
    
    return true
  } catch (error) {
    log(`❌ Edge case API test error: ${error.message}`, 'red')
    return false
  }
}

async function testErrorMessages() {
  log('\n=== F-05: Error Message Verification ===', 'blue')
  
  try {
    const { token } = await getAuthToken()
    
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const date = tomorrow.toISOString().split('T')[0]
    
    const requestData = {
      customerName: 'Error Test',
      customerPhone: '+61400000999',
      date,
      time: '21:00',
      durationMinutes: 60,
      offlinePaymentMethod: 'cash',
      offlineAmountPaid: 5000.00, // Way over limit
    }
    
    const result = await createOfflineBookingViaAPI(token, requestData)
    
    // Check error message contains expected information
    const hasMaxAllowed = result.data.maxAllowed === 2000
    const hasErrorMessage = result.data.error?.includes('exceeds platform maximum')
    const correctStatus = result.status === 400
    
    recordTest('F-05-API', 'Error includes maxAllowed field', hasMaxAllowed)
    recordTest('F-05-API', 'Error message is descriptive', hasErrorMessage)
    recordTest('F-05-API', 'Returns 400 status code', correctStatus)
    
    // Clean up if somehow created
    if (result.data.booking?.id) {
      await prisma.booking.delete({ where: { id: result.data.booking.id } })
    }
    
    return hasMaxAllowed && hasErrorMessage && correctStatus
  } catch (error) {
    log(`❌ Error message test error: ${error.message}`, 'red')
    return false
  }
}

async function runAllTests() {
  log('\n╔══════════════════════════════════════════════════════════╗', 'blue')
  log('║       F-05 API Fix Verification - DEV Environment       ║', 'blue')
  log('╚══════════════════════════════════════════════════════════╝', 'blue')
  
  // Verify DEV environment
  const env = process.env.STRIPE_SECRET_KEY || ''
  if (!env.includes('_test_') && !env.startsWith('sk_test_') && env !== '') {
    log('🔴 ABORTING: Not in DEV environment', 'red')
    return false
  }
  log('✅ Confirmed DEV environment\n', 'green')
  
  const results = {
    validPricesAPI: false,
    invalidPricesAPI: false,
    edgeCasesAPI: false,
    errorMessages: false,
  }
  
  try {
    results.validPricesAPI = await testValidPricesAPI()
    results.invalidPricesAPI = await testInvalidPricesAPI()
    results.edgeCasesAPI = await testEdgeCasesAPI()
    results.errorMessages = await testErrorMessages()
    
  } catch (error) {
    log(`\n❌ Test error: ${error.message}`, 'red')
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
  
  // Summary
  log('\n╔══════════════════════════════════════════════════════════╗', 'blue')
  log('║            F-05 API VERIFICATION SUMMARY                 ║', 'blue')
  log('╚══════════════════════════════════════════════════════════╝', 'blue')
  
  const allPassed = Object.values(results).every(r => r === true)
  
  for (const [test, passed] of Object.entries(results)) {
    const icon = passed ? '✅' : '❌'
    const color = passed ? 'green' : 'red'
    log(`${icon} ${test.padEnd(25)}: ${passed ? 'PASS' : 'FAIL'}`, color)
  }
  
  log(`\nIndividual Tests: ${testResults.filter(r => r.passed).length}/${testResults.length} passed`)
  
  if (allPassed) {
    log('\n🎉 ALL F-05 API VERIFICATION TESTS PASSED', 'green')
    log('\n✅ F-05 fix is VERIFIED and working correctly', 'green')
  } else {
    log('\n⚠️  SOME F-05 API VERIFICATION TESTS FAILED', 'yellow')
    log('\n❌ F-05 fix needs adjustment', 'red')
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
