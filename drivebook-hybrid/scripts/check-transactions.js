const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactions() {
  try {
    console.log('Checking transactions for bookings...\n');

    // Get the client record
    const client = await prisma.client.findUnique({
      where: { id: '69996e3fb3895e34697953a9' },
      include: {
        instructor: {
          select: {
            name: true
          }
        }
      }
    });

    if (!client) {
      console.log('❌ Client not found');
      return;
    }

    console.log('✅ Client found:', client.name);
    console.log('📧 Email:', client.email);
    console.log('👨‍🏫 Instructor:', client.instructor.name);

    // Get all transactions for this instructor
    const transactions = await prisma.transaction.findMany({
      where: {
        instructorId: client.instructorId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n💳 Total transactions for instructor: ${transactions.length}`);

    if (transactions.length > 0) {
      console.log('\n📝 Transaction details:');
      transactions.forEach((t, i) => {
        console.log(`\n${i + 1}. Transaction ID: ${t.id}`);
        console.log(`   Booking ID: ${t.bookingId || 'N/A'}`);
        console.log(`   Type: ${t.type}`);
        console.log(`   Amount: $${t.amount}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Payment Intent: ${t.stripePaymentIntentId || 'N/A'}`);
        console.log(`   Created: ${t.createdAt.toISOString()}`);
        console.log(`   Processed: ${t.processedAt ? t.processedAt.toISOString() : 'Not processed'}`);
      });

      // Check if any transactions match the bookings
      const bookingIds = transactions.map(t => t.bookingId).filter(Boolean);
      console.log(`\n🔗 Unique booking IDs in transactions: ${[...new Set(bookingIds)].length}`);

      // Get those bookings
      const bookings = await prisma.booking.findMany({
        where: {
          id: { in: bookingIds }
        }
      });

      console.log(`\n📊 Bookings found: ${bookings.length}`);
      bookings.forEach((b, i) => {
        console.log(`\n${i + 1}. Booking ID: ${b.id}`);
        console.log(`   Status: ${b.status}`);
        console.log(`   isPaid: ${b.isPaid}`);
        console.log(`   Price: $${b.price}`);
        console.log(`   Start: ${b.startTime.toISOString()}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactions();
