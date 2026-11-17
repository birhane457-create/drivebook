/**
 * Cleanup leftover ph5sch test records from the Supabase staging database.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const deleted = await (prisma as any).bookingIdempotencyKey.deleteMany({
    where: { email: { contains: 'ph5sch' } },
  })
  console.log('Deleted leftover idempotency keys:', deleted.count)

  // Also clean any other ph5sch records that may remain
  const deletedAudit = await prisma.auditLog.deleteMany({
    where: { actorId: { startsWith: 'ph5sch' } },
  })
  console.log('Deleted leftover audit logs:', deletedAudit.count)

  await prisma.$disconnect()
  console.log('Cleanup complete')
}

main().catch(e => { console.error(e.message); process.exit(1) })
