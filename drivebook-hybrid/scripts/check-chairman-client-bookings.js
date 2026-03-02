const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChairmanClientBookings() {
  console.log('🔍 Checking chairman@erotc.org Client Bookings\n');

  try {
    // Find all client records for this email
    const clients = await prisma.client.findMany({
      where: {
        email: 'chairman@erotc.org'
      },
      include: {
        instructor: {
          include: {
            user: true
          }
        },
        bookings: {
          include: {
            instructor: {
              include: {
                user: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    console.log(`Found ${clients.length} client records for chairman@erotc.org\n`);

    let totalBookings = 0;

    for (const client of clients) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`👤 Client Record: ${client.id}`);
      console.log(`   Name: ${client.name}`);
      console.log(`   Email: ${client.email}`);
      console.log(`   Phone: ${client.phone}`);
      console.log(`   Instructor: ${client.instructor?.name || 'N/A'}`);
      console.log(`   Instructor Email: ${client.instructor?.user?.email || 'N/A'}`);
      console.log(`   User ID: ${client.userId || 'Not linked'}`);
      console.log(`   Created: ${client.createdAt.toLocaleString()}`);
      console.log(`\n   📅 Bookings: ${client.bookings.length}\n`);

      totalBookings += client.bookings.length;

      if (client.bookings.length > 0) {
        for (const booking of client.bookings) {
          console.log(`   📋 Booking: ${booking.id}`);
          console.log(`      Status: ${booking.status}`);
          console.log(`      Price: $${booking.price}`);
          console.log(`      Start: ${booking.startTime.toLocaleString()}`);
          console.log(`      End: ${booking.endTime.toLocaleString()}`);
          console.log(`      Duration: ${((booking.endTime - booking.startTime) / (1000 * 60 * 60)).toFixed(2)} hours`);
          console.log(`      Is Package: ${booking.isPackageBooking}`);
          console.log(`      Package Hours: ${booking.packageHours || 'N/A'}`);
          console.log(`      Package Status: ${booking.packageStatus || 'N/A'}`);
          console.log(`      Parent Booking: ${booking.parentBookingId || 'None'}`);
          console.log(`      User ID: ${booking.userId || 'Not linked'}`);
          console.log(`      Pickup: ${booking.pickupAddress || 'N/A'}`);
          console.log(`      Created: ${booking.createdAt.toLocaleString()}`);
          console.log(`      Payment Intent: ${booking.paymentIntentId || 'None'}`);
          console.log(`      Paid At: ${booking.paidAt ? booking.paidAt.toLocaleString() : 'Not paid'}`);
          console.log('');
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total Client Records: ${clients.length}`);
    console.log(`   Total Bookings: ${totalBookings}\n`);

    // Check if there's a user account
    const user = await prisma.user.findUnique({
      where: { email: 'chairman@erotc.org' }
    });

    if (user) {
      console.log(`\n👤 User Account:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);

      // Check if clients are linked to user
      const linkedClients = clients.filter(c => c.userId === user.id);
      const unlinkedClients = clients.filter(c => !c.userId || c.userId !== user.id);

      console.log(`\n   Linked Clients: ${linkedClients.length}`);
      console.log(`   Unlinked Clients: ${unlinkedClients.length}`);

      if (unlinkedClients.length > 0) {
        console.log(`\n   ⚠️  ISSUE: ${unlinkedClients.length} client record(s) not linked to user account`);
        console.log(`   This means bookings won't show in user's dashboard\n`);

        for (const client of unlinkedClients) {
          console.log(`   Unlinked Client: ${client.id}`);
          console.log(`      Name: ${client.name}`);
          console.log(`      Bookings: ${client.bookings.length}`);
          console.log(`      Instructor: ${client.instructor?.user?.email}\n`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChairmanClientBookings();
