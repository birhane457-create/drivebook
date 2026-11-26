import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, termsAcceptedAt: true, termsVersion: true, emailVerified: true, emailVerifiedAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const u of users) {
    console.log(
      `${u.email} | role=${u.role} | terms=${u.termsAcceptedAt ? 'Y' : 'N'} | ev=${u.emailVerified ? 'Y' : 'N'} | created=${u.createdAt.toISOString().slice(0, 10)}`
    );
  }
  console.log(`\nTotal: ${users.length}`);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
