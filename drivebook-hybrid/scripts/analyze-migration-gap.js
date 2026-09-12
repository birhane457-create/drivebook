const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Count all paid bookings
  const allPaidBookings = await prisma.booking.count({
    where: {
      isPaid: true,
      status: { in: ['CONFIRMED', 'COMPLETED'] }
    }
  });
  
  console.log(`Total paid bookings: ${allPaidBookings}`);
  
  // Count transactions with bookingId
  const transactionsWithBooking = await prisma.transaction.count({
    where: {
      bookingId: { not: null }
    }
  });
  
  console.log(`Transactions with bookingId: ${transactionsWithBooking}`);
  
  // Count completed transactions
  const completedTransactions = await prisma.transaction.count({
    where: { status: 'COMPLETED' }
  });
  
  console.log(`Completed transactions: ${completedTransactions}`);
  
  // Get all transactions
  const allTransactions = await prisma.transaction.findMany({
    select: {
      id: true,
      bookingId: true,
      status: true,
      amount: true,
      instructorPayout: true,
      description: true
    }
  });
  
  console.log(`\nAll transactions (${allTransactions.length}):`);
  for (const t of allTransactions) {
    console.log(`  ${t.id}: ${t.status}, booking=${t.bookingId ? 'yes' : 'NO'}, amount=${t.amount}, payout=${t.instructorPayout}`);
  }
  
  // Check for duplicate transactions
  const duplicates = await prisma.transaction.groupBy({
    by: ['bookingId'],
    where: { bookingId: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } }
  });
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Found ${duplicates.length} bookings with duplicate transactions:`);
    for (const dup of duplicates) {
      console.log(`  Booking ${dup.bookingId}: ${dup._count.id} transactions`);
    }
  }
  
  await prisma.$disconnect();
}

main();
