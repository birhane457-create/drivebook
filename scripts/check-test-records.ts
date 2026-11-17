/**
 * Safety check: query for leftover ph5sch test records and total live data counts.
 * Read-only. Run before any further test execution against this Supabase project.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [users, providers, bookings, idempKeys, quotes, auditLogs] = await Promise.all([
    prisma.user.count({ where: { email: { startsWith: 'ph5sch' } } }),
    prisma.provider.count({ where: { name: { startsWith: 'ph5sch' } } }),
    prisma.booking.count({ where: { customerName: { startsWith: 'ph5sch' } } }),
    (prisma as any).bookingIdempotencyKey.count({ where: { email: { contains: 'ph5sch' } } }),
    (prisma as any).quote.count({ where: { description: { contains: 'ph5sch' } } }),
    prisma.auditLog.count({ where: { metadata: { path: ['sessionId'], string_starts_with: 'cs_ph5sch' } } }).catch(() => 0),
  ])

  console.log('=== Leftover ph5sch test records ===')
  console.log(JSON.stringify({ users, providers, bookings, idempKeys, quotes, auditLogs }, null, 2))

  const [totalProviders, totalBookings, totalUsers, totalTransactions] = await Promise.all([
    prisma.provider.count(),
    prisma.booking.count(),
    prisma.user.count(),
    prisma.transaction.count(),
  ])

  console.log('\n=== Total live record counts (environment check) ===')
  console.log(JSON.stringify({ totalProviders, totalBookings, totalUsers, totalTransactions }, null, 2))

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
