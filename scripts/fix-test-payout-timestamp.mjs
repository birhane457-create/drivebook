import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const result = await prisma.payout.updateMany({
    where: { status: 'PROCESSING', reservedAt: { not: null } },
    data: { updatedAt: tenMinAgo },
  });
  console.log('Updated', result.count, 'payouts — updatedAt set to 10 min ago');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
