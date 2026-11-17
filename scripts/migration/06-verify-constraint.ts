/**
 * Verify the Transaction_bookingId_fkey constraint exists with ON DELETE RESTRICT.
 * Checks pg_constraint directly — no assumptions.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const url = process.env.DATABASE_URL || ''
  console.log(`Connected to: ${url.match(/@([^:/?]+)/)?.[1] ?? 'unknown'}`)
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  // Check the constraint definition directly from pg_constraint
  const constraints = await prisma.$queryRaw<Array<{
    conname: string
    confdeltype: string
    confupdtype: string
    conrelid_table: string
    confrelid_table: string
  }>>`
    SELECT
      c.conname,
      c.confdeltype,
      c.confupdtype,
      rel.relname AS conrelid_table,
      frel.relname AS confrelid_table
    FROM pg_constraint c
    JOIN pg_class rel ON c.conrelid = rel.oid
    JOIN pg_class frel ON c.confrelid = frel.oid
    WHERE c.conname = 'Transaction_bookingId_fkey'
  `

  if (constraints.length === 0) {
    console.log('❌ Transaction_bookingId_fkey constraint NOT FOUND')
    console.log('   The constraint does not exist in this database.')
    console.log('   This database may have been set up with db push (no migrations).')
  } else {
    for (const c of constraints) {
      const deleteAction = c.confdeltype === 'r' ? 'RESTRICT' :
                           c.confdeltype === 'c' ? 'CASCADE' :
                           c.confdeltype === 'n' ? 'SET NULL' :
                           c.confdeltype === 'a' ? 'NO ACTION' : `UNKNOWN (${c.confdeltype})`
      const updateAction = c.confupdtype === 'c' ? 'CASCADE' :
                           c.confupdtype === 'r' ? 'RESTRICT' :
                           c.confupdtype === 'n' ? 'SET NULL' :
                           c.confupdtype === 'a' ? 'NO ACTION' : `UNKNOWN (${c.confupdtype})`

      console.log(`Constraint: ${c.conname}`)
      console.log(`  Table: ${c.conrelid_table} → References: ${c.confrelid_table}`)
      console.log(`  ON DELETE: ${deleteAction}`)
      console.log(`  ON UPDATE: ${updateAction}`)
      console.log(`  ${deleteAction === 'RESTRICT' ? '✅ PH5-SCH-10 APPLIED' : '❌ Still ' + deleteAction + ' — not yet fixed'}`)
    }
  }

  // Also check _prisma_migrations table for our migration
  try {
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string, finished_at: Date | null }>>`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE migration_name LIKE '%ph5_sch10%'
    `
    if (migrations.length > 0) {
      console.log(`\nMigration record: ${migrations[0].migration_name}`)
      console.log(`  Applied at: ${migrations[0].finished_at}`)
    } else {
      console.log('\n⚠️  Migration not found in _prisma_migrations table')
      console.log('   This database may have been set up with db push, not migrate deploy.')
      console.log('   The constraint may need to be applied via direct SQL.')
    }
  } catch {
    console.log('\n⚠️  _prisma_migrations table does not exist')
    console.log('   This database was set up with prisma db push, not prisma migrate.')
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
