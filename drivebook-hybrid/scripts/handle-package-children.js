const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function handlePackageChildren() {
  console.log('📦 Handling Package Children Bookings\n');

  try {
    // Find package children that are still PENDING with $0 price
    const packageChildren = await prisma.booking.findMany({
      where: {
        price: 0,
        status: 'PENDING',
        parentBookingId: { not: null }
      },
      include: {
        client: true,
        instructor: true
      }
    });

    console.log(`Found ${packageChildren.length} package children bookings\n`);

    if (packageChildren.length === 0) {
      console.log('✅ No package children to handle\n');
      return;
    }

    for (const child of packageChildren) {
      console.log(`\n📋 Child Booking: ${child.id}`);
      console.log(`   Client: ${child.client?.name}`);
      console.log(`   Date: ${child.startTime.toLocaleString()}`);
      console.log(`   Duration: ${((child.endTime - child.startTime) / (1000 * 60 * 60)).toFixed(2)} hours`);

      // Get parent booking
      const parent = await prisma.booking.findUnique({
        where: { id: child.parentBookingId }
      });

      if (!parent) {
        console.log(`   ❌ Parent not found - deleting child`);
        await prisma.booking.delete({ where: { id: child.id } });
        continue;
      }

      console.log(`\n   📦 Parent Package: ${parent.id}`);
      console.log(`      Price: $${parent.price}`);
      console.log(`      Total Hours: ${parent.packageHours}`);
      console.log(`      Hours Used: ${parent.packageHoursUsed || 0}`);
      console.log(`      Hours Remaining: ${parent.packageHoursRemaining || parent.packageHours}`);
      console.log(`      Status: ${parent.packageStatus}`);

      // Check if the booking date has passed
      const now = new Date();
      const isPast = child.startTime < now;

      console.log(`\n   ⏰ Booking is ${isPast ? 'in the PAST' : 'in the FUTURE'}`);

      if (isPast) {
        console.log(`   🗑️  Deleting past unconfirmed booking`);
        await prisma.booking.delete({ where: { id: child.id } });
      } else {
        console.log(`   ⚠️  Future booking - keeping for now`);
        console.log(`      User can confirm via: /api/client/confirm-package-booking`);
        console.log(`      Or it will be auto-deleted if date passes`);
      }
    }

    // Final summary
    const remainingChildren = await prisma.booking.count({
      where: {
        price: 0,
        status: 'PENDING',
        parentBookingId: { not: null }
      }
    });

    console.log(`\n\n📊 Final Summary:`);
    console.log(`   Remaining package children: ${remainingChildren}`);

    // Check Debesay's updated count
    const debesayInstructor = await prisma.instructor.findFirst({
      where: { 
        user: { email: 'birhane457@gmail.com' }
      },
      include: {
        _count: {
          select: { bookings: true }
        }
      }
    });

    if (debesayInstructor) {
      console.log(`\n👤 Debesay Birhane (birhane457@gmail.com):`);
      console.log(`   Current booking count: ${debesayInstructor._count.bookings}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

handlePackageChildren();
