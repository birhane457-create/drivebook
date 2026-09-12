const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findPaidTransactions() {
  try {
    console.log('Searching for completed transactions with payment intents...\n');

    // Search for the specific payment intents mentioned by the user
    const paymentIntents = [
      'pi_3T2aR4PFqwsHwRMq2h62IJPE',
      'pi_3T2aR4PFqwsHwRMq1P45F2r1',
      'pi_3T2agKPFqwsHwRMq1OaLKFJM',
      'pi_3T2agKPFqwsHwRMq0IUhkXy2'
    ];

    for (const pi of paymentIntents) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          stripePaymentIntentId: pi
        },
        include: {
          booking: {
            include: {
              client: true,
              instructor: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      if (transaction) {
        console.log(`✅ Found transaction for ${pi}`);
        console.log(`   Transaction ID: ${transaction.id}`);
        console.log(`   Booking ID: ${transaction.bookingId}`);
        console.log(`   Amount: $${transaction.amount}`);
        console.log(`   Status: ${transaction.status}`);
        console.log(`   Instructor: ${transaction.booking.instructor.name}`);
        console.log(`   Client Email: ${transaction.booking.client.email}`);
        console.log(`   Client ID: ${transaction.booking.clientId}`);
        console.log(`   User ID: ${transaction.booking.userId || 'null'}`);
        console.log(`   Booking Status: ${transaction.booking.status}`);
        console.log(`   Booking isPaid: ${transaction.booking.isPaid}`);
        console.log('');
      } else {
        console.log(`❌ No transaction found for ${pi}\n`);
      }
    }

    // Also search for all COMPLETED transactions
    console.log('\n📊 All COMPLETED transactions:');
    const completedTransactions = await prisma.transaction.findMany({
      where: {
        status: 'COMPLETED'
      },
      include: {
        booking: {
          include: {
            client: true,
            instructor: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${completedTransactions.length} completed transactions\n`);

    completedTransactions.forEach((t, i) => {
      console.log(`${i + 1}. Transaction ID: ${t.id}`);
      console.log(`   Payment Intent: ${t.stripePaymentIntentId}`);
      console.log(`   Amount: $${t.amount}`);
      console.log(`   Instructor: ${t.booking.instructor.name}`);
      console.log(`   Client: ${t.booking.client.email}`);
      console.log(`   Client ID: ${t.booking.clientId}`);
      console.log(`   Booking Status: ${t.booking.status}`);
      console.log(`   Booking isPaid: ${t.booking.isPaid}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findPaidTransactions();
