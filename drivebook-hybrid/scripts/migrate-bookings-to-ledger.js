/**
 * Migrate Existing Bookings to Financial Ledger
 * 
 * This script migrates existing paid bookings to the new
 * double-entry ledger system.
 * 
 * CRITICAL: Run this ONCE after ledger system is deployed
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateBookingsToLedger() {
  console.log('🔄 Migrating Bookings to Financial Ledger\n');

  try {
    // Get all paid bookings that haven't been migrated to ledger
    const paidBookings = await prisma.booking.findMany({
      where: {
        isPaid: true,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      include: {
        instructor: true,
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${paidBookings.length} paid bookings to migrate\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const booking of paidBookings) {
      try {
        // Check if already migrated (idempotency)
        const existingEntry = await prisma.financialLedger.findUnique({
          where: { idempotencyKey: `booking-${booking.id}-payment` },
        });

        if (existingEntry) {
          console.log(`⏭️  Booking ${booking.id} already migrated`);
          skipCount++;
          continue;
        }

        // Validate amounts
        if (!booking.price || !booking.platformFee || !booking.instructorPayout) {
          console.log(`⚠️  Booking ${booking.id} missing amounts - skipping`);
          skipCount++;
          continue;
        }

        if (!booking.userId) {
          console.log(`⚠️  Booking ${booking.id} missing userId - skipping`);
          skipCount++;
          continue;
        }

        // Create ledger entries
        const entries = [
          // Entry 1: Client pays into escrow
          {
            debitAccount: `CLIENT_WALLET:${booking.userId}`,
            creditAccount: 'PLATFORM_ESCROW:platform',
            amount: booking.price,
            description: `Migration: Payment for booking #${booking.id}`,
            idempotencyKey: `booking-${booking.id}-payment`,
            bookingId: booking.id,
            userId: booking.userId,
            instructorId: booking.instructorId,
            metadata: {
              type: 'booking_payment',
              migrated: true,
              originalDate: booking.createdAt,
            },
            createdBy: 'MIGRATION',
          },

          // Entry 2: Platform takes commission
          {
            debitAccount: 'PLATFORM_ESCROW:platform',
            creditAccount: 'PLATFORM_REVENUE:platform',
            amount: booking.platformFee,
            description: `Migration: Platform commission for booking #${booking.id}`,
            idempotencyKey: `booking-${booking.id}-commission`,
            bookingId: booking.id,
            userId: booking.userId,
            instructorId: booking.instructorId,
            metadata: {
              type: 'commission',
              migrated: true,
              rate: (booking.platformFee / booking.price) * 100,
            },
            createdBy: 'MIGRATION',
          },

          // Entry 3: Instructor earns payout
          {
            debitAccount: 'PLATFORM_ESCROW:platform',
            creditAccount: `INSTRUCTOR_PAYABLE:${booking.instructorId}`,
            amount: booking.instructorPayout,
            description: `Migration: Instructor payout for booking #${booking.id}`,
            idempotencyKey: `booking-${booking.id}-instructor-payout`,
            bookingId: booking.id,
            userId: booking.userId,
            instructorId: booking.instructorId,
            metadata: {
              type: 'instructor_payout',
              migrated: true,
            },
            createdBy: 'MIGRATION',
          },
        ];

        // Create all entries in a transaction
        await prisma.$transaction(
          entries.map((entry) =>
            prisma.financialLedger.create({
              data: entry,
            })
          )
        );

        console.log(`✅ Migrated booking ${booking.id} ($${booking.price})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating booking ${booking.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${successCount}`);
    console.log(`  ⏭️  Skipped: ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total: ${paidBookings.length}`);

    // Verify ledger integrity
    console.log('\n🔍 Verifying Ledger Integrity...');
    const allEntries = await prisma.financialLedger.findMany();
    const totalDebits = allEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = allEntries.reduce((sum, e) => sum + e.amount, 0);
    const difference = Math.abs(totalDebits - totalCredits);

    console.log(`  Total Debits: $${totalDebits.toFixed(2)}`);
    console.log(`  Total Credits: $${totalCredits.toFixed(2)}`);
    console.log(`  Difference: $${difference.toFixed(2)}`);
    console.log(`  Valid: ${difference < 0.01 ? '✅' : '❌'}`);

    // Show platform summary
    console.log('\n💰 Platform Financial Summary:');
    const revenue = await prisma.financialLedger.aggregate({
      where: { creditAccount: 'PLATFORM_REVENUE:platform' },
      _sum: { amount: true },
    });
    const revenueDebits = await prisma.financialLedger.aggregate({
      where: { debitAccount: 'PLATFORM_REVENUE:platform' },
      _sum: { amount: true },
    });
    const netRevenue = (revenue._sum.amount || 0) - (revenueDebits._sum.amount || 0);

    const escrow = await prisma.financialLedger.aggregate({
      where: { creditAccount: 'PLATFORM_ESCROW:platform' },
      _sum: { amount: true },
    });
    const escrowDebits = await prisma.financialLedger.aggregate({
      where: { debitAccount: 'PLATFORM_ESCROW:platform' },
      _sum: { amount: true },
    });
    const netEscrow = (escrow._sum.amount || 0) - (escrowDebits._sum.amount || 0);

    console.log(`  Platform Revenue: $${netRevenue.toFixed(2)}`);
    console.log(`  Platform Escrow: $${netEscrow.toFixed(2)}`);

    console.log('\n✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateBookingsToLedger();
