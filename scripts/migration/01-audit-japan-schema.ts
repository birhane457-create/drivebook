/**
 * Step 1: Audit the Japan database — list all tables and their record counts.
 * Run against Japan BEFORE any migration work.
 * Output is the migration baseline.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const url = process.env.DATABASE_URL ?? '(not set)'
  const host = url.match(/@([^:/?]+)/)?.[1] ?? 'unknown'
  console.log(`=== Japan database audit ===`)
  console.log(`Host: ${host}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log('')

  // All tables in the current Prisma schema
  const queries: Array<[string, () => Promise<number>]> = [
    ['User', () => prisma.user.count()],
    ['Provider', () => prisma.provider.count()],
    ['Customer', () => prisma.customer.count()],
    ['Booking', () => prisma.booking.count()],
    ['Transaction', () => prisma.transaction.count()],
    ['Subscription', () => prisma.subscription.count()],
    ['Payout', () => prisma.payout.count()],
    ['AuditLog', () => prisma.auditLog.count()],
    ['Notification', () => prisma.notification.count()],
    ['SlotReservation', () => prisma.slotReservation.count()],
    ['BookingIdempotencyKey', () => (prisma as any).bookingIdempotencyKey.count()],
    ['WebhookEvent', () => (prisma as any).webhookEvent.count()],
    ['PlatformSettings', () => (prisma as any).platformSettings.count()],
    ['PlatformLedger', () => (prisma as any).platformLedger.count()],
    ['LedgerEntry', () => (prisma as any).ledgerEntry.count()],
    ['FinancialLedger', () => (prisma as any).financialLedger.count()],
    ['Business', () => (prisma as any).business.count()],
  ]

  const counts: Record<string, number | string> = {}
  let total = 0

  for (const [name, q] of queries) {
    try {
      const n = await q()
      counts[name] = n
      total += n
    } catch (e: any) {
      counts[name] = `SKIP: ${e.message.split('\n')[0].substring(0, 80)}`
    }
  }

  console.log('=== Table record counts ===')
  for (const [k, v] of Object.entries(counts)) {
    const numeric = typeof v === 'number'
    const icon = numeric ? (v > 0 ? '✓' : '·') : '!'
    console.log(`  ${icon} ${k.padEnd(28)} ${v}`)
  }
  console.log(`\n  Total rows with data: ${total}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
