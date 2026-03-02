const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookingIds = [
    '699bc25b5971aada29dd5817',
    '699bbdd88e571c6a3e054cf0',
    '699bbdd88e571c6a3e054cef'
  ];
  
  console.log('🔍 CHECKING SPECIFIC BOOKINGS\n');
  
  for (const id of bookingIds) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true } },
        instructor: { select: { name: true } }
      }
    });
    
    if (!booking) {
      console.log(`❌ Booking ${id} not found\n`);
      continue;
    }
    
    console.log(`Booking ID: ${booking.id}`);
    console.log(`  Client: ${booking.client.name} (${booking.client.email})`);
    console.log(`  Instructor: ${booking.instructor.name}`);
    console.log(`  Status: ${booking.status}`);
    console.log(`  Price: $${booking.price}`);
    console.log(`  Start: ${new Date(booking.startTime).toLocaleString()}`);
    console.log(`  Created By: ${booking.createdBy}`);
    console.log(`  Is Paid: ${booking.isPaid}`);
    console.log(`  Payment Captured: ${booking.paymentCaptured}`);
    console.log(`  Payment Intent ID: ${booking.paymentIntentId || 'none'}`);
    console.log(`  Created At: ${new Date(booking.createdAt).toLocaleString()}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
