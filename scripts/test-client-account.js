const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testClientAccount() {
  try {
    console.log('🔍 Checking for recent client accounts...\n');

    // Find recent users with CLIENT role
    const recentClients = await prisma.user.findMany({
      where: {
        role: 'CLIENT',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        clients: {
          include: {
            instructor: {
              select: {
                name: true
              }
            }
          }
        },
        bookings: {
          select: {
            id: true,
            status: true,
            isPaid: true,
            price: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentClients.length === 0) {
      console.log('❌ No recent client accounts found in the last 24 hours');
      return;
    }

    console.log(`✅ Found ${recentClients.length} recent client account(s):\n`);

    for (const user of recentClients) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Email: ${user.email}`);
      console.log(`🆔 User ID: ${user.id}`);
      console.log(`📅 Created: ${user.createdAt.toLocaleString()}`);
      console.log(`👤 Role: ${user.role}`);
      
      if (user.clients.length > 0) {
        console.log(`\n📋 Client Records (${user.clients.length}):`);
        user.clients.forEach((client, idx) => {
          console.log(`  ${idx + 1}. Name: ${client.name}`);
          console.log(`     Phone: ${client.phone}`);
          console.log(`     Instructor: ${client.instructor.name}`);
        });
      }

      if (user.bookings.length > 0) {
        console.log(`\n📚 Bookings (${user.bookings.length}):`);
        user.bookings.forEach((booking, idx) => {
          console.log(`  ${idx + 1}. ID: ${booking.id}`);
          console.log(`     Status: ${booking.status}`);
          console.log(`     Paid: ${booking.isPaid ? '✅ Yes' : '❌ No'}`);
          console.log(`     Price: £${booking.price}`);
          console.log(`     Created: ${booking.createdAt.toLocaleString()}`);
        });
      }

      console.log('\n');
    }

    // Check if welcome emails should have been sent
    console.log('\n📬 Email Status:');
    console.log('Welcome emails are sent by the payment webhook after successful payment.');
    console.log('Check your email service logs or inbox for:');
    recentClients.forEach(user => {
      console.log(`  - ${user.email}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClientAccount();
