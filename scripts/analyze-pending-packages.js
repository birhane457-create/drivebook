const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzePendingPackages() {
  console.log('🔍 Analyzing PENDING Bookings with Prices\n');

  try {
    const instructor = await prisma.instructor.findFirst({
      where: { 
        user: { email: 'birhane457@gmail.com' }
      },
      include: {
        bookings: {
          where: {
            status: 'PENDING',
            price: { gt: 0 }
          },
          include: {
            client: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!instructor) {
      console.log('❌ Instructor not found\n');
      return;
    }

    console.log(`Found ${instructor.bookings.length} PENDING bookings with price > $0\n`);

    // Categorize by isPackageBooking flag
    const packagePurchases = [];
    const regularBookings = [];

    for (const booking of instructor.bookings) {
      console.log(`\n📋 Booking: ${booking.id}`);
      console.log(`   Price: $${booking.price}`);
      console.log(`   Date: ${booking.startTime.toLocaleString()}`);
      console.log(`   Is Package Booking: ${booking.isPackageBooking}`);
      console.log(`   Package Hours: ${booking.packageHours || 'N/A'}`);
      console.log(`   Package Status: ${booking.packageStatus || 'N/A'}`);
      console.log(`   Has Parent: ${booking.parentBookingId ? 'Yes' : 'No'}`);
      console.log(`   Created: ${booking.createdAt.toLocaleString()}`);

      if (booking.isPackageBooking) {
        packagePurchases.push(booking);
        console.log(`   🎁 TYPE: PACKAGE PURCHASE (should NOT count as booking)`);
      } else {
        regularBookings.push(booking);
        console.log(`   📅 TYPE: REGULAR BOOKING (should count as booking)`);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Package Purchases (isPackageBooking=true): ${packagePurchases.length}`);
    console.log(`   Regular Bookings (isPackageBooking=false): ${regularBookings.length}`);
    console.log(`   Total PENDING with price: ${instructor.bookings.length}\n`);

    console.log(`\n💡 ISSUE IDENTIFIED:`);
    console.log(`   Current system counts BOTH package purchases AND bookings`);
    console.log(`   Package purchases should be stored separately (wallet credits)`);
    console.log(`   Only actual scheduled bookings should count as "bookings"\n`);

    console.log(`\n🎯 CORRECT ARCHITECTURE:`);
    console.log(`   1. Package Purchase Flow:`);
    console.log(`      - User buys 10 hours for $700`);
    console.log(`      - Money goes to CLIENT WALLET (not a booking)`);
    console.log(`      - No booking record created`);
    console.log(`      - Wallet shows: $700 credit, 10 hours available\n`);
    console.log(`   2. Book from Package Flow:`);
    console.log(`      - User schedules 2 hours from wallet`);
    console.log(`      - Creates 1 BOOKING record (2 hours, $140 deducted from wallet)`);
    console.log(`      - Wallet shows: $560 remaining, 8 hours available`);
    console.log(`      - Booking count: 1 (not 2)\n`);
    console.log(`   3. Book Now & Complete Flow:`);
    console.log(`      - User books 2 hours immediately`);
    console.log(`      - Creates 1 BOOKING record`);
    console.log(`      - Payment processed immediately`);
    console.log(`      - Booking count: 1\n`);

    // Check if wallet system exists
    const wallets = await prisma.clientWallet.findMany({
      where: {
        client: {
          instructorId: instructor.id
        }
      },
      include: {
        client: true
      }
    });

    console.log(`\n💰 Current Wallet System:`);
    console.log(`   Client Wallets Found: ${wallets.length}`);
    for (const wallet of wallets) {
      console.log(`\n   Client: ${wallet.client?.name}`);
      console.log(`   Credits Remaining: $${wallet.creditsRemaining}`);
      console.log(`   Total Added: $${wallet.totalAdded}`);
      console.log(`   Total Spent: $${wallet.totalSpent}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzePendingPackages();
