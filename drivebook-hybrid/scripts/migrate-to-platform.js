/**
 * Migration Script: Single Instructor → Multi-Instructor Platform
 * 
 * This script updates existing instructors to work with the new platform features
 * 
 * Run with: node scripts/migrate-to-platform.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting migration to multi-instructor platform...\n');

  try {
    // 1. Update existing instructors with new fields
    console.log('📝 Updating existing instructors...');
    const instructors = await prisma.instructor.findMany();
    
    for (const instructor of instructors) {
      await prisma.instructor.update({
        where: { id: instructor.id },
        data: {
          approvalStatus: 'APPROVED', // Auto-approve existing instructors
          approvedAt: new Date(),
          isActive: true,
          subscriptionTier: 'basic',
          documentsVerified: false,
          averageRating: null,
          totalReviews: 0,
          totalBookings: 0,
          isFeatured: false,
        },
      });
      console.log(`  ✅ Updated instructor: ${instructor.name}`);
    }

    // 2. Calculate existing booking counts
    console.log('\n📊 Calculating booking statistics...');
    for (const instructor of instructors) {
      const bookingCount = await prisma.booking.count({
        where: { instructorId: instructor.id },
      });

      const completedCount = await prisma.booking.count({
        where: {
          instructorId: instructor.id,
          status: 'COMPLETED',
        },
      });

      const completionRate = bookingCount > 0 
        ? (completedCount / bookingCount) * 100 
        : 0;

      await prisma.instructor.update({
        where: { id: instructor.id },
        data: {
          totalBookings: bookingCount,
          completionRate,
        },
      });

      console.log(`  ✅ ${instructor.name}: ${bookingCount} bookings, ${completionRate.toFixed(1)}% completion rate`);
    }

    // 3. Create platform configuration
    console.log('\n⚙️  Creating platform configuration...');
    const existingPlatform = await prisma.platform.findFirst();
    
    if (!existingPlatform) {
      await prisma.platform.create({
        data: {
          name: process.env.PLATFORM_NAME || 'DriveBook',
          commissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '15'),
          subscriptionModel: 'commission',
          basicMonthly: 29.99,
          proMonthly: 79.99,
          premiumMonthly: 149.99,
          settings: {
            currency: 'USD',
            timezone: 'UTC',
            emailNotifications: true,
          },
        },
      });
      console.log('  ✅ Platform configuration created');
    } else {
      console.log('  ℹ️  Platform configuration already exists');
    }

    // 4. Update bookings with payment tracking fields
    console.log('\n💳 Updating booking payment tracking...');
    await prisma.booking.updateMany({
      where: { isPaid: null },
      data: {
        isPaid: true, // Assume existing bookings are paid
        isReviewed: false,
      },
    });
    console.log('  ✅ Booking payment tracking updated');

    // 5. Summary
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  - Instructors updated: ${instructors.length}`);
    console.log(`  - Platform configuration: Created`);
    console.log(`  - Booking tracking: Updated`);
    console.log('\n🎉 Your platform is now ready for multi-instructor features!');
    console.log('\n📝 Next steps:');
    console.log('  1. Create an admin user (see PLATFORM_SETUP_GUIDE.md)');
    console.log('  2. Login to /admin to access the dashboard');
    console.log('  3. Configure Stripe for payments (optional)');
    console.log('  4. Test the instructor approval workflow\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrate();
