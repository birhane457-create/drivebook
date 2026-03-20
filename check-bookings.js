const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const total = await p.booking.count();
  console.log('Total bookings (no filter):', total);

  const withDeletedNull = await p.booking.count({ where: { deletedAt: null } });
  console.log('With deletedAt: null:', withDeletedNull);

  const sample = await p.booking.findMany({ take: 3, select: { id: true, status: true, deletedAt: true } });
  console.log('Sample:', JSON.stringify(sample, null, 2));
}
main().catch(console.error).finally(() => p.$disconnect());
