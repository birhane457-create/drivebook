/**
 * Migrate production Users from Japan to Sydney.
 * Only Users — bookings, transactions, subscriptions are test data.
 *
 * Usage:
 *   JAPAN_URL=<japan> SYDNEY_URL=<sydney> npx ts-node --transpile-only scripts/migration/04-migrate-users-only.ts
 */
import { PrismaClient } from '@prisma/client'

const japan  = new PrismaClient({ datasourceUrl: process.env.JAPAN_URL })
const sydney = new PrismaClient({ datasourceUrl: process.env.SYDNEY_URL })

async function main() {
  console.log('Japan  →', process.env.JAPAN_URL?.match(/@([^:/?]+)/)?.[1])
  console.log('Sydney →', process.env.SYDNEY_URL?.match(/@([^:/?]+)/)?.[1])
  console.log('Started:', new Date().toISOString())

  const users: any[] = await japan.$queryRaw`SELECT * FROM "User"`
  console.log(`\nFound ${users.length} users in Japan`)

  let ok = 0, skipped = 0
  for (const u of users) {
    try {
      await sydney.user.upsert({
        where: { id: u.id },
        update: {
          email:    u.email,
          name:     u.name     ?? null,
          role:     u.role     ?? 'CLIENT',
          updatedAt: u.updatedAt ?? new Date(),
        },
        create: {
          id:        u.id,
          email:     u.email,
          password:  u.password ?? null,
          name:      u.name     ?? null,
          role:      u.role     ?? 'CLIENT',
          providerId: null,
          createdAt: u.createdAt ?? new Date(),
          updatedAt: u.updatedAt ?? new Date(),
        },
      })
      console.log(`  ✓ ${u.email} (${u.role})`)
      ok++
    } catch (e: any) {
      console.error(`  ✗ ${u.email}: ${e.message.split('\n')[0]}`)
      skipped++
    }
  }

  console.log(`\nDone: ${ok} migrated, ${skipped} skipped`)
  console.log('Finished:', new Date().toISOString())
  await japan.$disconnect()
  await sydney.$disconnect()
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
