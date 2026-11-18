/**
 * Cleanup leftover ph5sch* test records from the Supabase staging database.
 *
 * SAFETY GUARD: This script deletes records. It refuses to run against
 * production databases. Set CLEANUP_ALLOW_PRODUCTION=1 to override
 * (only if you know exactly what you are doing).
 *
 * Covers all entity types created by PH5-SCH-30 and PH5-SCH-35 tests:
 *   - BookingIdempotencyKey (email contains 'ph5sch')
 *   - AuditLog (actorId starts with ph5sch — from ph5sch35 Customer IDs)
 *   - Quote (description contains 'ph5sch')
 *   - Booking (customerName starts with 'ph5sch')
 *   - Customer (preferredProviderId is a ph5sch provider)
 *   - Provider (name starts with 'ph5sch')
 *   - User (email starts with 'ph5sch')
 *
 * Run after every test execution to maintain a clean staging database.
 * Deletion order respects FK constraints (children before parents).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Safety guard: refuse to run against production
  const url = process.env.DATABASE_URL || ''
  const blocked = ['jflrqxigfiiqednfacuf']  // Sydney production only — Japan test project allowed
  if (blocked.some(h => url.includes(h)) && process.env.CLEANUP_ALLOW_PRODUCTION !== '1') {
    console.error('REFUSED: DATABASE_URL points at the Sydney production database.')
    console.error('The Japan test project (zzntmozvppyzeaqautpi) is allowed for cleanup.')
    process.exit(1)
  }
  console.log('=== Cleaning leftover ph5sch test records ===\n')

  // Find ph5sch providers first to scope related deletions
  const testProviders = await prisma.provider.findMany({
    where: { name: { startsWith: 'ph5sch' } },
    select: { id: true },
  })
  const testProviderIds = testProviders.map(p => p.id)
  console.log(`Found ${testProviderIds.length} ph5sch provider(s)`)

  // Find ph5sch customers
  const testCustomers = await prisma.customer.findMany({
    where: { email: { startsWith: 'ph5sch' } },
    select: { id: true },
  })
  const testCustomerIds = testCustomers.map(c => c.id)
  console.log(`Found ${testCustomerIds.length} ph5sch customer(s)`)

  // 1. IdempotencyKeys
  const d1 = await (prisma as any).bookingIdempotencyKey.deleteMany({
    where: { email: { contains: 'ph5sch' } },
  })
  console.log(`BookingIdempotencyKey: deleted ${d1.count}`)

  // 2. AuditLog (actorId = customer.id OR targetId = quote.id from ph5sch tests)
  const d2 = await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: testCustomerIds } },
        { metadata: { path: ['sessionId'], string_starts_with: 'cs_ph5sch' } },
      ],
    },
  })
  console.log(`AuditLog: deleted ${d2.count}`)

  // 3. Quotes (belong to ph5sch providers)
  const d3 = await (prisma as any).quote.deleteMany({
    where: { providerId: { in: testProviderIds } },
  })
  console.log(`Quote: deleted ${d3.count}`)

  // 4. Bookings (belong to ph5sch providers)
  const d4 = await prisma.booking.deleteMany({
    where: { providerId: { in: testProviderIds } },
  })
  console.log(`Booking: deleted ${d4.count}`)

  // 5. SlotReservations (belong to ph5sch providers)
  const d5 = await prisma.slotReservation.deleteMany({
    where: { providerId: { in: testProviderIds } },
  })
  console.log(`SlotReservation: deleted ${d5.count}`)

  // 6. Customers (email starts with ph5sch)
  const d6 = await prisma.customer.deleteMany({
    where: { email: { startsWith: 'ph5sch' } },
  })
  console.log(`Customer: deleted ${d6.count}`)

  // 7. Providers (name starts with ph5sch)
  const d7 = await prisma.provider.deleteMany({
    where: { name: { startsWith: 'ph5sch' } },
  })
  console.log(`Provider: deleted ${d7.count}`)

  // 8. Users (email starts with ph5sch)
  const d8 = await prisma.user.deleteMany({
    where: { email: { startsWith: 'ph5sch' } },
  })
  console.log(`User: deleted ${d8.count}`)

  console.log('\n=== Cleanup complete ===')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
