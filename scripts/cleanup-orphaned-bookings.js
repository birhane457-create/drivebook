const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOrphanedBookings() {
  console.log('🧹 Cleaning up orphaned $0 PENDING bookings\n');

  try {
    // Find all $0 PENDING bookings
    const zeroPriceBookings = await prisma.booking.findMany({
      where: {
        price: 0,
        status: 'PENDING'
      },
      include: {
        client: true,
        instructor: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${zeroPriceBookings.length} bookings with $0 price and PENDING status\n`);

    // Categorize bookings
    const orphanedBookings = [];
    const packageChildrenWithParent = [];
    const packageChildrenWithoutParent = [];

    for (const booking of zeroPriceBookings) {
      if (booking.parentBookingId) {
        // Check if parent exists
        const parent = await prisma.booking.findUnique({
          where: { id: booking.parentBookingId }
        });

        if (parent) {
          packageChildrenWithParent.push({ booking, parent });
        } else {
          packageChildrenWithoutParent.push(booking);
        }
      } else {
        // No parent - likely incomplete booking flow
        orphanedBookings.push(booking);
      }
    }

    console.log('📊 Categorization:');
    console.log(`   Orphaned (no parent, incomplete flow): ${orphanedBookings.length}`);
    console.log(`   Package children with valid parent: ${packageChildrenWithParent.length}`);
    console.log(`   Package children with missing parent: ${packageChildrenWithoutParent.length}\n`);

    // Handle orphaned bookings (delete them)
    if (orphanedBookings.length > 0) {
      console.log('🗑️  Deleting orphaned bookings (incomplete booking flow):\n');
      
      for (const booking of orphanedBookings) {
        console.log(`   ❌ ${booking.id}`);
        console.log(`      Client: ${booking.client?.name}`);
        console.log(`      Date: ${booking.startTime.toLocaleString()}`);
        console.log(`      Created: ${booking.createdAt.toLocaleString()}`);
        console.log(`      Age: ${Math.floor((Date.now() - booking.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days\n`);
      }

      const deleteOrphaned = await prisma.booking.deleteMany({
        where: {
          id: { in: orphanedBookings.map(b => b.id) }
        }
      });

      console.log(`   ✅ Deleted ${deleteOrphaned.count} orphaned bookings\n`);
    }

    // Handle package children with valid parents
    if (packageChildrenWithParent.length > 0) {
      console.log('📦 Package children with valid parents (need confirmation):\n');
      
      for (const { booking, parent } of packageChildrenWithParent) {
        console.log(`   ⚠️  ${booking.id}`);
        console.log(`      Parent: ${parent.id}`);
        console.log(`      Client: ${booking.client?.name}`);
        console.log(`      Date: ${booking.startTime.toLocaleString()}`);
        console.log(`      Parent Price: $${parent.price}`);
        console.log(`      Parent Hours: ${parent.packageHours}`);
        console.log(`      Parent Status: ${parent.packageStatus}`);
        console.log(`      Action: Should be confirmed via /api/client/confirm-package-booking\n`);
      }

      console.log(`   ℹ️  These ${packageChildrenWithParent.length} bookings are legitimate package children`);
      console.log(`      They need to be confirmed through the proper flow or deleted if abandoned\n`);
    }

    // Handle package children without parents (delete them)
    if (packageChildrenWithoutParent.length > 0) {
      console.log('🗑️  Deleting package children with missing parents:\n');
      
      for (const booking of packageChildrenWithoutParent) {
        console.log(`   ❌ ${booking.id}`);
        console.log(`      Missing Parent: ${booking.parentBookingId}`);
        console.log(`      Client: ${booking.client?.name}`);
        console.log(`      Date: ${booking.startTime.toLocaleString()}\n`);
      }

      const deleteOrphaned = await prisma.booking.deleteMany({
        where: {
          id: { in: packageChildrenWithoutParent.map(b => b.id) }
        }
      });

      console.log(`   ✅ Deleted ${deleteOrphaned.count} package children with missing parents\n`);
    }

    // Summary
    console.log('📊 Summary:');
    console.log(`   Total $0 PENDING bookings found: ${zeroPriceBookings.length}`);
    console.log(`   Deleted orphaned bookings: ${orphanedBookings.length}`);
    console.log(`   Deleted children with missing parents: ${packageChildrenWithoutParent.length}`);
    console.log(`   Remaining package children (need confirmation): ${packageChildrenWithParent.length}`);
    console.log(`   Total deleted: ${orphanedBookings.length + packageChildrenWithoutParent.length}\n`);

    // Check updated booking count for Debesay
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
      console.log('👤 Debesay Birhane (birhane457@gmail.com):');
      console.log(`   Updated booking count: ${debesayInstructor._count.bookings}`);
      console.log(`   Previous count: 32`);
      console.log(`   Difference: ${32 - debesayInstructor._count.bookings} bookings removed\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedBookings();
