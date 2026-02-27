const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChairmanWallet() {
  console.log('🔧 Fixing chairman@erotc.org Wallet\n');

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: 'chairman@erotc.org' }
    });

    if (!user) {
      console.log('❌ User not found\n');
      return;
    }

    console.log(`👤 User: ${user.email} (${user.id})\n`);

    // Find package purchase booking
    const packageBooking = await prisma.booking.findUnique({
      where: { id: '699eff972868f9a184260732' },
      include: {
        instructor: {
          include: {
            user: true
          }
        }
      }
    });

    if (!packageBooking) {
      console.log('❌ Package booking not found\n');
      return;
    }

    console.log('📦 Package Purchase Booking Found:');
    console.log(`   ID: ${packageBooking.id}`);
    console.log(`   Price: $${packageBooking.price}`);
    console.log(`   Package Hours: ${packageBooking.packageHours}`);
    console.log(`   Status: ${packageBooking.status}`);
    console.log(`   Is Package: ${packageBooking.isPackageBooking}\n`);

    // Find wallet
    let wallet = await prisma.clientWallet.findFirst({
      where: { userId: user.id }
    });

    if (!wallet) {
      console.log('❌ Wallet not found\n');
      return;
    }

    console.log('💰 Current Wallet:');
    console.log(`   ID: ${wallet.id}`);
    console.log(`   Balance: $${wallet.balance}`);
    console.log(`   Credits Remaining: $${wallet.creditsRemaining}`);
    console.log(`   Total Added: $${wallet.totalPaid}`);
    console.log(`   Total Spent: $${wallet.totalSpent}\n`);

    // Step 1: Add package value to wallet
    console.log('🔄 Step 1: Adding package value to wallet...');
    const updatedWallet = await prisma.clientWallet.update({
      where: { id: wallet.id },
      data: {
        creditsRemaining: { increment: packageBooking.price },
        totalPaid: { increment: packageBooking.price },
        balance: { increment: packageBooking.price }
      }
    });

    console.log(`   ✅ Wallet updated:`);
    console.log(`      Credits Remaining: $${updatedWallet.creditsRemaining}`);
    console.log(`      Total Added: $${updatedWallet.totalPaid}`);
    console.log(`      Balance: $${updatedWallet.balance}\n`);

    // Step 2: Create wallet transaction
    console.log('🔄 Step 2: Creating wallet transaction...');
    const transaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'package_purchase',
        amount: packageBooking.price,
        description: `Package purchase: ${packageBooking.packageHours} hours with ${packageBooking.instructor?.name || 'instructor'}`,
        status: 'completed',
        metadata: {
          originalBookingId: packageBooking.id,
          hours: packageBooking.packageHours,
          instructorId: packageBooking.instructorId,
          instructorName: packageBooking.instructor?.name,
          convertedFromBooking: true,
          conversionDate: new Date().toISOString()
        }
      }
    });

    console.log(`   ✅ Transaction created: ${transaction.id}\n`);

    // Step 3: Link bookings to user account
    console.log('🔄 Step 3: Linking bookings to user account...');
    const linkedBookings = await prisma.booking.updateMany({
      where: {
        clientId: { in: ['69987b174adba4fc848be379', '699eff972868f9a184260731'] },
        userId: null
      },
      data: {
        userId: user.id
      }
    });

    console.log(`   ✅ Linked ${linkedBookings.count} bookings to user account\n`);

    // Step 4: Delete package purchase booking
    console.log('🔄 Step 4: Deleting package purchase booking...');
    await prisma.booking.delete({
      where: { id: packageBooking.id }
    });

    console.log(`   ✅ Package booking deleted (now in wallet)\n`);

    // Step 5: Handle package child booking
    const childBooking = await prisma.booking.findUnique({
      where: { id: '699eff982868f9a184260733' }
    });

    if (childBooking) {
      console.log('🔄 Step 5: Handling package child booking...');
      console.log(`   Child Booking: ${childBooking.id}`);
      console.log(`   Date: ${childBooking.startTime.toLocaleString()}`);
      console.log(`   Duration: ${((childBooking.endTime - childBooking.startTime) / (1000 * 60 * 60)).toFixed(2)} hours`);
      
      // Calculate price per hour
      const pricePerHour = packageBooking.price / packageBooking.packageHours;
      const childDuration = (childBooking.endTime - childBooking.startTime) / (1000 * 60 * 60);
      const childPrice = pricePerHour * childDuration;

      console.log(`   Price per hour: $${pricePerHour.toFixed(2)}`);
      console.log(`   Child booking price: $${childPrice.toFixed(2)}\n`);

      // Update child booking
      await prisma.booking.update({
        where: { id: childBooking.id },
        data: {
          status: 'CONFIRMED',
          price: childPrice,
          parentBookingId: null,
          userId: user.id
        }
      });

      console.log(`   ✅ Child booking updated to CONFIRMED with price $${childPrice.toFixed(2)}\n`);

      // Deduct from wallet
      await prisma.clientWallet.update({
        where: { id: wallet.id },
        data: {
          creditsRemaining: { decrement: childPrice },
          totalSpent: { increment: childPrice }
        }
      });

      console.log(`   ✅ Deducted $${childPrice.toFixed(2)} from wallet\n`);

      // Create wallet transaction for booking
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'booking_debit',
          amount: -childPrice,
          description: `Booking: ${childDuration.toFixed(1)} hour(s) on ${childBooking.startTime.toLocaleDateString()}`,
          status: 'completed',
          bookingId: childBooking.id,
          metadata: {
            hours: childDuration,
            instructorId: childBooking.instructorId
          }
        }
      });

      console.log(`   ✅ Wallet transaction created for booking\n`);
    }

    // Final summary
    const finalWallet = await prisma.clientWallet.findUnique({
      where: { id: wallet.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const finalBookings = await prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    console.log('═'.repeat(60));
    console.log('\n📊 FINAL STATE:\n');
    console.log('💰 Wallet:');
    console.log(`   Credits Remaining: $${finalWallet.creditsRemaining.toFixed(2)}`);
    console.log(`   Total Added: $${finalWallet.totalPaid.toFixed(2)}`);
    console.log(`   Total Spent: $${finalWallet.totalSpent.toFixed(2)}`);
    console.log(`   Balance: $${finalWallet.balance.toFixed(2)}`);
    console.log(`   Transactions: ${finalWallet.transactions.length}\n`);

    console.log('📅 Bookings:');
    console.log(`   Total: ${finalBookings.length}`);
    for (const booking of finalBookings) {
      console.log(`   - ${booking.status.padEnd(10)} | $${booking.price.toString().padEnd(8)} | ${booking.startTime.toLocaleDateString()}`);
    }

    console.log('\n✅ Fix completed successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixChairmanWallet();
