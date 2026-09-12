const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkClientUserLink() {
  try {
    console.log('=== CHECKING CLIENT-USER LINKS ===\n');

    // Get the booking
    const booking = await prisma.booking.findFirst({
      where: {
        status: { not: 'CANCELLED' },
        startTime: { gt: new Date() }
      },
      include: {
        client: {
          include: {
            user: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    if (!booking) {
      console.log('No bookings found');
      return;
    }

    console.log('BOOKING INFO:');
    console.log(`  Booking ID: ${booking.id}`);
    console.log(`  Booking userId: ${booking.userId}`);
    console.log(`  Booking clientId: ${booking.clientId}\n`);

    console.log('CLIENT INFO:');
    console.log(`  Client ID: ${booking.client.id}`);
    console.log(`  Client Name: ${booking.client.name}`);
    console.log(`  Client Email: ${booking.client.email}`);
    console.log(`  Client userId: ${booking.client.userId}\n`);

    if (booking.client.user) {
      console.log('USER INFO (from client):');
      console.log(`  User ID: ${booking.client.user.id}`);
      console.log(`  User Email: ${booking.client.user.email}`);
      console.log(`  User Role: ${booking.client.user.role}\n`);

      // Check if this user can access the booking
      const clientRecords = await prisma.client.findMany({
        where: { userId: booking.client.user.id },
        select: { id: true }
      });
      
      console.log('AUTHORIZATION CHECK:');
      console.log(`  User's client IDs: ${clientRecords.map(c => c.id).join(', ')}`);
      console.log(`  Booking's client ID: ${booking.clientId}`);
      console.log(`  Can access: ${clientRecords.some(c => c.id === booking.clientId) ? '✅ YES' : '❌ NO'}\n`);
    } else {
      console.log('⚠️  WARNING: Client has no associated user!\n');
      
      // Try to find a user with matching email
      const user = await prisma.user.findUnique({
        where: { email: booking.client.email }
      });
      
      if (user) {
        console.log('FOUND USER WITH MATCHING EMAIL:');
        console.log(`  User ID: ${user.id}`);
        console.log(`  User Email: ${user.email}`);
        console.log(`  User Role: ${user.role}`);
        console.log(`\n  ⚠️  This client should be linked to this user!\n`);
      } else {
        console.log('  ❌ No user found with email:', booking.client.email);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClientUserLink();
