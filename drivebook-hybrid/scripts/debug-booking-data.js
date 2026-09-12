const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check the transaction that's being referenced
  const transaction = await prisma.transaction.findFirst({
    where: { id: '699743150f3d120bffdb5e0e' }
  });
  
  console.log('Transaction 699743150f3d120bffdb5e0e:');
  console.log(JSON.stringify(transaction, null, 2));
  
  // Check the booking that failed
  const booking = await prisma.booking.findFirst({
    where: { id: '699743040f3d120bffdb5e0d' },
    include: { client: true }
  });
  
  console.log('\nBooking 699743040f3d120bffdb5e0d:');
  console.log(`  price: ${booking.price}`);
  console.log(`  platformFee: ${booking.platformFee}`);
  console.log(`  instructorPayout: ${booking.instructorPayout}`);
  console.log(`  isPaid: ${booking.isPaid}`);
  console.log(`  clientId: ${booking.clientId}`);
  console.log(`  client.userId: ${booking.client?.userId}`);
  
  await prisma.$disconnect();
}

main();
