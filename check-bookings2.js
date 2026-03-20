const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const bookings = await p.booking.findMany({
    take: 5,
    orderBy: { startTime: 'desc' },
    select: { id: true, status: true, startTime: true, endTime: true, clientName: true }
  });
  console.log('Sample bookings:', JSON.stringify(bookings, null, 2));

  const now = new Date();
  const all = await p.booking.findMany({ select: { id: true, status: true, endTime: true } });
  const endedConfirmed = all.filter(b => b.status === 'CONFIRMED' && b.endTime && new Date(b.endTime) <= now);
  console.log('Total:', all.length);
  console.log('Ended+CONFIRMED:', endedConfirmed.length);
  const byStatus = {};
  all.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
  console.log('By status:', byStatus);
}
main().catch(console.error).finally(() => p.$disconnect());
