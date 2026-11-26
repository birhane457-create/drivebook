import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.provider.findMany({
    where: { approvalStatus: 'PENDING' },
    select: { id: true, name: true, approvalStatus: true, user: { select: { email: true, emailVerified: true } } },
  });
  console.log('PENDING providers:', providers.length);
  for (const p of providers) {
    console.log(`  ${p.user.email} | emailVerified=${p.user.emailVerified}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
