import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasourceUrl: process.env.SYDNEY_URL })
async function main() {
  const users = await prisma.user.findMany({ select: { email: true, role: true } })
  console.log(`Sydney User count: ${users.length}`)
  users.forEach(u => console.log(`  ${u.email} (${u.role})`))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e.message); process.exit(1) })
