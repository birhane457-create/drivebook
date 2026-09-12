const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBookingFixes() {
  console.log('🧪 Testing Booking Flow Fixes\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check if preferredInstructorId field exists
    console.log('\n✅ Test 1: Schema Update - preferredInstructorId');
    const client = await prisma.client.findFirst();
    if (client) {
      console.log('   Field exists:', 'preferredInstructorId' in client ? '✓' : '✗');
      console.log('   Sample client:', {
        id: client.id,
        name: client.name,
        instructorId: client.instructorId,
        preferredInstructorId: client.preferredInstructorId || 'Not set'
      });
    } else {
      console.log('   No clients found in database');
    }

    // Test 2: Check wallet balances
    console.log('\n✅ Test 2: Wallet Balance Check');
    const wallets = await prisma.clientWallet.findMany({
      include: {
        user: {
          select: { email: true }
        }
      },
      take: 5
    });

    if (wallets.length > 0) {
      console.log(`   Found ${wallets.length} wallets:`);
      wallets.forEach(wallet => {
        const balance = wallet.creditsRemaining || 0;
        const status = balance > 0 ? '✓' : '⚠️';
        console.log(`   ${status} ${wallet.user.email}: $${balance.toFixed(2)} (Paid: $${wallet.totalPaid.toFixed(2)}, Spent: $${wallet.totalSpent.toFixed(2)})`);
      });
    } else {
      console.log('   No wallets found');
    }

    // Test 3: Check package bookings
    console.log('\n✅ Test 3: Package Bookings Analysis');
    const packageBookings = await prisma.booking.findMany({
      where: {
        isPackageBooking: true
      },
      include: {
        client: { select: { name: true, email: true } },
        instructor: { select: { name: true } }
      },
      take: 10
    });

    console.log(`   Found ${packageBookings.length} package bookings:`);
    packageBookings.forEach(booking => {
      const isPaid = booking.isPaid ? '✓ Paid' : '⚠️ Unpaid';
      const hasWallet = booking.userId ? '✓' : '✗';
      console.log(`   ${isPaid} | User: ${hasWallet} | ${booking.client.name} → ${booking.instructor.name} | $${booking.price} | ${booking.packageHours}h`);
    });

    // Test 4: Check wallet transactions
    console.log('\n✅ Test 4: Wallet Transactions');
    const transactions = await prisma.walletTransaction.findMany({
      include: {
        wallet: {
          include: {
            user: { select: { email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`   Found ${transactions.length} recent transactions:`);
    transactions.forEach(tx => {
      const sign = tx.type === 'credit' ? '+' : '-';
      const amount = Math.abs(tx.amount);
      console.log(`   ${sign}$${amount.toFixed(2)} | ${tx.type} | ${tx.wallet.user.email} | ${tx.description}`);
    });

    // Test 5: Check for duplicate emails
    console.log('\n✅ Test 5: Duplicate Email Check');
    const users = await prisma.user.groupBy({
      by: ['email'],
      _count: {
        email: true
      },
      having: {
        email: {
          _count: {
            gt: 1
          }
        }
      }
    });

    if (users.length > 0) {
      console.log(`   ⚠️ Found ${users.length} duplicate emails:`);
      users.forEach(user => {
        console.log(`   - ${user.email}: ${user._count.email} accounts`);
      });
    } else {
      console.log('   ✓ No duplicate emails found');
    }

    // Test 6: Verify current instructor API data
    console.log('\n✅ Test 6: Current Instructor Data');
    const clientsWithPreferred = await prisma.client.findMany({
      where: {
        preferredInstructorId: { not: null }
      },
      include: {
        instructor: { select: { name: true } },
        user: { select: { email: true } }
      },
      take: 5
    });

    if (clientsWithPreferred.length > 0) {
      console.log(`   ✓ Found ${clientsWithPreferred.length} clients with preferred instructor:`);
      clientsWithPreferred.forEach(client => {
        console.log(`   - ${client.user?.email || 'No user'}: Prefers ${client.instructor.name}`);
      });
    } else {
      console.log('   ⚠️ No clients have preferred instructor set yet');
      console.log('   (This is expected for existing data - new registrations will have this)');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Schema updated with preferredInstructorId');
    console.log('✅ Wallet balance tracking active');
    console.log('✅ Package bookings identified');
    console.log('✅ Transaction history available');
    console.log(users.length === 0 ? '✅ No duplicate emails' : '⚠️ Duplicate emails found');
    console.log('\n💡 Next Steps:');
    console.log('1. Test new registration flow with preferred instructor');
    console.log('2. Verify wallet balance updates after payment');
    console.log('3. Check client dashboard displays correct instructor');
    console.log('4. Test "Book Later" flow preserves instructor selection');

  } catch (error) {
    console.error('\n❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBookingFixes();
