/**
 * Apply PH5-SCH-10 directly via raw SQL.
 * The Sydney database was set up with prisma db push, not migrate deploy.
 * The _prisma_migrations table does not exist, so prisma migrate deploy
 * cannot be used. This script executes the migration SQL directly.
 *
 * Safety: this only changes a constraint definition — no data is modified.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const url = process.env.DATABASE_URL || ''
  console.log(`Connected to: ${url.match(/@([^:/?]+)/)?.[1] ?? 'unknown'}`)
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // Step 1: Check current state BEFORE
  const before = await prisma.$queryRaw<Array<{ conname: string; confdeltype: string }>>`
    SELECT conname, confdeltype
    FROM pg_constraint
    WHERE conname = 'Transaction_bookingId_fkey'
  `

  if (before.length === 0) {
    console.log('❌ Constraint Transaction_bookingId_fkey not found — cannot proceed')
    process.exit(1)
  }

  const beforeAction = before[0].confdeltype === 'c' ? 'CASCADE' : before[0].confdeltype
  console.log(`BEFORE: ON DELETE ${beforeAction === 'c' ? 'CASCADE' : beforeAction}`)
  console.log(`  confdeltype code: ${before[0].confdeltype}`)

  if (before[0].confdeltype === 'r') {
    console.log('Already RESTRICT — nothing to do')
    await prisma.$disconnect()
    return
  }

  // Step 2: Drop the existing CASCADE constraint
  console.log('\nDropping Transaction_bookingId_fkey...')
  await prisma.$executeRaw`ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_bookingId_fkey"`
  console.log('  Dropped.')

  // Step 3: Re-add with ON DELETE RESTRICT
  console.log('Re-adding with ON DELETE RESTRICT...')
  await prisma.$executeRaw`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
  console.log('  Added.')

  // Step 4: Verify AFTER
  const after = await prisma.$queryRaw<Array<{ conname: string; confdeltype: string }>>`
    SELECT conname, confdeltype
    FROM pg_constraint
    WHERE conname = 'Transaction_bookingId_fkey'
  `

  const afterAction = after[0].confdeltype === 'r' ? 'RESTRICT' :
                       after[0].confdeltype === 'c' ? 'CASCADE' : after[0].confdeltype

  console.log(`\nAFTER: ON DELETE ${afterAction}`)
  console.log(`  confdeltype code: ${after[0].confdeltype}`)

  if (after[0].confdeltype === 'r') {
    console.log('\n✅ PH5-SCH-10 APPLIED: Transaction → Booking FK is now ON DELETE RESTRICT')
  } else {
    console.log('\n❌ FAILED: constraint is still not RESTRICT')
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
