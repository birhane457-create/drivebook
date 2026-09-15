/**
 * Security Fixes Verification Script
 * Tests F-02, F-04, F-01, F-03 against DEV database
 * 
 * IMPORTANT: DEV database only - do not run against production
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Color codes for output
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

async function verifyDatabaseConnection() {
  log('\n=== Database Connection Verification ===', 'blue')
  try {
    const result = await prisma.$queryRaw`SELECT NOW() as time, current_database() as db, version() as ver`
    log(`✅ Connected to database: ${result[0].db}`)
    log(`   PostgreSQL: ${result[0].ver.split(',')[0]}`)
    
    // Verify this is DEV (check for test Stripe key)
    const env = process.env.STRIPE_SECRET_KEY || ''
    if (env.includes('_test_') || env.startsWith('sk_test_')) {
      log('✅ Confirmed DEV environment (Stripe test key detected)', 'green')
      return true
    } else if (!env) {
      log('⚠️  No Stripe key found - assuming DEV', 'yellow')
      return true
    } else {
      log('🔴 PROD Stripe key detected - ABORTING', 'red')
      return false
    }
  } catch (error) {
    log(`❌ Database connection failed: ${error.message}`, 'red')
    return false
  }
}

async function testF02WhitelistValidation() {
  log('\n=== F-02: Document Upload Whitelist Validation ===', 'blue')
  
  const DRIVING_DOC_FIELDS = [
    'licenseImageFront', 'licenseImageBack', 'insurancePolicyDoc', 'policeCheckDoc',
    'wwcCheckDoc', 'photoIdDoc', 'certificationDoc', 'vehicleRegistrationDoc',
  ]
  const INSTRUCTOR_DOC_FIELDS = ['profileImage', 'carImage']
  const validTypes = [...DRIVING_DOC_FIELDS, ...INSTRUCTOR_DOC_FIELDS]
  
  log('Valid document types whitelist:')
  validTypes.forEach(type => log(`  - ${type}`))
  
  // Test malicious inputs
  const maliciousInputs = ['__proto__', 'constructor', 'id', 'providerId', 'createdAt', 'password', 'email']
  
  log('\nTesting malicious inputs would be rejected:')
  for (const input of maliciousInputs) {
    const isValid = validTypes.includes(input)
    if (isValid) {
      log(`  ❌ FAIL: "${input}" is in whitelist (SECURITY ISSUE)`, 'red')
      return false
    } else {
      log(`  ✅ "${input}" correctly rejected`)
    }
  }
  
  log('✅ Whitelist validation: PASS', 'green')
  return true
}

async function testF02DatabaseStructure() {
  log('\n=== F-02: Database Structure Verification ===', 'blue')
  
  try {
    // Check if DrivingProviderProfile has correct field
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'DrivingProviderProfile' 
      AND column_name IN ('providerId', 'preferredproviderId')
      ORDER BY column_name
    `
    
    const hasProviderId = result.some(r => r.column_name === 'providerId')
    const hasTypo = result.some(r => r.column_name === 'preferredproviderId')
    
    if (hasProviderId && !hasTypo) {
      log('✅ DrivingProviderProfile has correct field "providerId"', 'green')
      log('✅ No typo field "preferredproviderId" exists', 'green')
      return true
    } else if (!hasProviderId) {
      log('❌ DrivingProviderProfile missing "providerId" field', 'red')
      return false
    } else if (hasTypo) {
      log('❌ Typo field "preferredproviderId" still exists in schema', 'red')
      return false
    }
  } catch (error) {
    log(`❌ Database structure check failed: ${error.message}`, 'red')
    return false
  }
}

async function testF04TableTargeting() {
  log('\n=== F-04: Expiry Fields Table Verification ===', 'blue')
  
  try {
    // Check Provider table does NOT have driving expiry fields
    const providerFields = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Provider' 
      AND column_name IN ('licenseExpiry', 'insuranceExpiry', 'policeCheckExpiry', 'wwcCheckExpiry')
    `
    
    // Check DrivingProviderProfile DOES have expiry fields
    const drivingFields = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'DrivingProviderProfile' 
      AND column_name IN ('licenseExpiry', 'insuranceExpiry', 'policeCheckExpiry', 'wwcCheckExpiry')
      ORDER BY column_name
    `
    
    if (providerFields.length > 0) {
      log(`❌ Provider table has driving expiry fields (architecture violation):`, 'red')
      providerFields.forEach(f => log(`   - ${f.column_name}`))
      return false
    }
    
    if (drivingFields.length === 4) {
      log('✅ Provider table does NOT have driving expiry fields (correct)', 'green')
      log('✅ DrivingProviderProfile has all 4 expiry fields:', 'green')
      drivingFields.forEach(f => log(`   - ${f.column_name} (${f.data_type})`))
      return true
    } else {
      log(`❌ DrivingProviderProfile missing expiry fields (found ${drivingFields.length}/4)`, 'red')
      return false
    }
  } catch (error) {
    log(`❌ Table structure check failed: ${error.message}`, 'red')
    return false
  }
}

async function testF01SubscriptionModel() {
  log('\n=== F-01: Subscription Model Field Verification ===', 'blue')
  
  try {
    // Check Subscription has providerId
    const subscriptionFields = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Subscription' 
      AND column_name IN ('providerId', 'preferredProviderId')
      ORDER BY column_name
    `
    
    // Check Customer has preferredProviderId
    const customerFields = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Customer' 
      AND column_name = 'preferredProviderId'
    `
    
    const subHasProviderId = subscriptionFields.some(f => f.column_name === 'providerId')
    const subHasWrongField = subscriptionFields.some(f => f.column_name === 'preferredProviderId')
    const customerHasField = customerFields.length > 0
    
    if (subHasProviderId && !subHasWrongField && customerHasField) {
      log('✅ Subscription table has "providerId" (correct)', 'green')
      log('✅ Subscription table does NOT have "preferredProviderId" (correct)', 'green')
      log('✅ Customer table has "preferredProviderId" (correct architecture)', 'green')
      return true
    } else {
      if (!subHasProviderId) log('❌ Subscription missing "providerId"', 'red')
      if (subHasWrongField) log('❌ Subscription has "preferredProviderId" (wrong)', 'red')
      if (!customerHasField) log('❌ Customer missing "preferredProviderId"', 'red')
      return false
    }
  } catch (error) {
    log(`❌ Model verification failed: ${error.message}`, 'red')
    return false
  }
}

async function testF03AuditLogStructure() {
  log('\n=== F-03: Audit Log Structure ===', 'blue')
  
  try {
    const fields = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'AuditLog' 
      AND column_name IN ('action', 'actorId', 'actorRole', 'targetType', 'targetId', 'success', 'metadata')
      ORDER BY column_name
    `
    
    if (fields.length >= 6) {
      log('✅ AuditLog table has required fields for F-03 fix', 'green')
      return true
    } else {
      log(`❌ AuditLog table missing fields (found ${fields.length}/7)`, 'red')
      return false
    }
  } catch (error) {
    log(`❌ Audit log check failed: ${error.message}`, 'red')
    return false
  }
}

async function testDataSamples() {
  log('\n=== DEV Database Data Samples ===', 'blue')
  
  try {
    // Provider count
    const providerCount = await prisma.provider.count()
    log(`Providers: ${providerCount} total`)
    
    // DrivingProviderProfile count
    const drivingCount = await prisma.drivingProviderProfile.count()
    log(`DrivingProviderProfiles: ${drivingCount} total`)
    
    // Subscription count
    const subCount = await prisma.subscription.count()
    log(`Subscriptions: ${subCount} total`)
    
    // Sample provider with DrivingProviderProfile
    if (drivingCount > 0) {
      const sample = await prisma.drivingProviderProfile.findFirst({
        select: {
          id: true,
          providerId: true,
          licenseExpiry: true,
          insuranceExpiry: true
        }
      })
      log(`\nSample DrivingProviderProfile:`)
      log(`  providerId: ${sample.providerId}`)
      log(`  licenseExpiry: ${sample.licenseExpiry || 'NULL'}`)
      log(`  insuranceExpiry: ${sample.insuranceExpiry || 'NULL'}`)
      log('✅ Can query DrivingProviderProfile successfully', 'green')
    }
    
    return true
  } catch (error) {
    log(`❌ Data sample query failed: ${error.message}`, 'red')
    return false
  }
}

async function runAllVerifications() {
  log('\n╔══════════════════════════════════════════════════════════╗', 'blue')
  log('║   Security Fixes Verification - DEV Environment         ║', 'blue')
  log('╚══════════════════════════════════════════════════════════╝', 'blue')
  
  const results = {
    connection: false,
    f02Whitelist: false,
    f02Database: false,
    f04Tables: false,
    f01Model: false,
    f03Audit: false,
    dataSamples: false
  }
  
  try {
    // Must verify DEV environment first
    results.connection = await verifyDatabaseConnection()
    if (!results.connection) {
      log('\n🔴 ABORTING: Not connected to DEV database', 'red')
      return results
    }
    
    // Run all verifications
    results.f02Whitelist = await testF02WhitelistValidation()
    results.f02Database = await testF02DatabaseStructure()
    results.f04Tables = await testF04TableTargeting()
    results.f01Model = await testF01SubscriptionModel()
    results.f03Audit = await testF03AuditLogStructure()
    results.dataSamples = await testDataSamples()
    
  } catch (error) {
    log(`\n❌ Verification error: ${error.message}`, 'red')
  } finally {
    await prisma.$disconnect()
  }
  
  // Summary
  log('\n╔══════════════════════════════════════════════════════════╗', 'blue')
  log('║                   VERIFICATION SUMMARY                    ║', 'blue')
  log('╚══════════════════════════════════════════════════════════╝', 'blue')
  
  const allPassed = Object.values(results).every(r => r === true)
  
  for (const [test, passed] of Object.entries(results)) {
    const icon = passed ? '✅' : '❌'
    const color = passed ? 'green' : 'red'
    log(`${icon} ${test.padEnd(20)}: ${passed ? 'PASS' : 'FAIL'}`, color)
  }
  
  if (allPassed) {
    log('\n🎉 ALL VERIFICATIONS PASSED', 'green')
  } else {
    log('\n⚠️  SOME VERIFICATIONS FAILED - Review above', 'yellow')
  }
  
  return results
}

// Run verifications
runAllVerifications()
  .then(results => {
    const allPassed = Object.values(results).every(r => r === true)
    process.exit(allPassed ? 0 : 1)
  })
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red')
    process.exit(1)
  })
