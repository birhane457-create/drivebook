import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function testConnection() {
  console.log('Testing database connection...\n')
  
  try {
    // Test 1: Simple query
    console.log('Test 1: Executing simple query...')
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, version() as pg_version`
    console.log('✅ Database connection successful!')
    console.log('Current time:', result[0].current_time)
    console.log('PostgreSQL version:', result[0].pg_version)
    
    // Test 2: Count providers
    console.log('\nTest 2: Counting providers...')
    const providerCount = await prisma.provider.count()
    console.log(`✅ Found ${providerCount} providers in database`)
    
    // Test 3: Count approved providers
    console.log('\nTest 3: Counting approved providers...')
    const approvedCount = await prisma.provider.count({
      where: { approvalStatus: 'APPROVED' }
    })
    console.log(`✅ Found ${approvedCount} approved providers`)
    
    // Test 4: Check DrivingProviderProfile table
    console.log('\nTest 4: Checking DrivingProviderProfile table...')
    const drivingProfileCount = await prisma.drivingProviderProfile.count()
    console.log(`✅ Found ${drivingProfileCount} driving profiles`)
    
    console.log('\n✅ All database tests passed!')
    console.log('\n📊 Summary:')
    console.log(`- Total providers: ${providerCount}`)
    console.log(`- Approved providers: ${approvedCount}`)
    console.log(`- Driving profiles: ${drivingProfileCount}`)
    
  } catch (error) {
    console.error('\n❌ Database connection failed!')
    console.error('Error:', error.message)
    if (error.code) console.error('Error code:', error.code)
    console.error('\nFull error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
