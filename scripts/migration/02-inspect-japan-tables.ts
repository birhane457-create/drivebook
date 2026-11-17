/**
 * Step 2: Inspect Japan database — list actual table names and row counts
 * using raw SQL (bypasses Prisma schema mismatch).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const url = process.env.DATABASE_URL ?? '(not set)'
  const host = url.match(/@([^:/?]+)/)?.[1] ?? 'unknown'
  console.log(`Host: ${host}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log('')

  // Get all public tables and their row counts
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `

  console.log('=== All tables in public schema ===')
  for (const { tablename } of tables) {
    try {
      const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "${tablename}"`
      )
      const count = Number(result[0].count)
      const icon = count > 0 ? '✓' : '·'
      console.log(`  ${icon} ${tablename.padEnd(40)} ${count}`)
    } catch (e: any) {
      console.log(`  ! ${tablename.padEnd(40)} ERROR: ${e.message.split('\n')[0].substring(0, 50)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
