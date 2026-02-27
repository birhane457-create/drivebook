const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migratePackagesToWallet() {
  console.log('🔄 Migrating Package Purchases to Wallet System\n');
  console.log('This will:');
  console.log('1. Find all package purchases (isPackageBooking=true)');
  console.log('2. Add package value to user wallet');
  console.log('3. Delete package booking records');
  console.log('4. Link bookings to user accounts');
  console.log('5. Handle package children bookings\n');

  try {
    // Find all package purchases
    const packagePurchases = await prisma.booking.findMany({
      where: {
        isPackageBooking: true
      },
      include: {
        client: {
          include: {
            user: true
          }
        },
        instructor: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📦 Found ${packagePurchases.length} package purchases\n`);

    if (packagePurchases.length === 0) {
      console.log('✅ No package purchases to migrate\n');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const pkg of packagePurchases) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Package: ${pkg.id}`);
      console.log(`   Client: ${pkg.client?.name || 'Unknown'}`);
      console.log(`   Email: ${pkg.client?.email || 'Unknown'}`);
      console.log(`   Price: $${pkg.price}`);
      console.log(`   Hours: ${pkg.packageHours}`);
      console.log(`   Instructor: ${pkg.instructor?.user?.email || 'Unknown'}`);

      // Find or get user ID
      let userId = pkg.userId || pkg.client?.userId;
      
      if (!userId) {
        console.log(`   ⚠️  No user account found - skipping`);
        errorCount++;
        continue;
      }

      console.log(`   User ID: ${userId}`);

      try {
        // Find or create wallet
        let wallet = await prisma.clientWallet.findFirst({
          where: { userId: userId }
        });

        if (!wallet) {
          console.log(`   Creating new wallet...`);
          wallet = await prisma.clientWallet.create({
            data: {
              userId: userId,
              balance: 0,
              totalPaid: 0,
              totalSpent: 0,
              creditsRemaining: 0
            }
          });
        }

        console.log(`   Wallet ID: ${wallet.id}`);

        // Add package value to wallet
        await prisma.clientWallet.update({
          where: { id: wallet.id },
          data: {
            creditsRemaining: { increment: pkg.price },
            totalPaid: { increment: pkg.price }
          }
        });

        console.log(`   ✅ Added $${pkg.price} to wallet`);

        // Create wallet transaction
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'credit',
            amount: pkg.price,
            description: `Package purchase: ${pkg.packageHours} hours`,
            status: 'completed',
            metadata: {
              originalBookingId: pkg.id,
              hours: pkg.packageHours,
              instructorId: pkg.instructorId,
              migratedAt: new Date().toISOString()
            }
          }
        });

        console.log(`   ✅ Created wallet transaction`);

        // Find package children
        const children = await prisma.booking.findMany({
          where: {
            parentBookingId: pkg.id
          }
        });

        console.log(`   Found ${children.length} package children`);

        for (const child of children) {
          console.log(`\n   📋 Child: ${child.id}`);
          console.log(`      Date: ${child.startTime.toLocaleString()}`);
          console.log(`      Status: ${child.status}`);
          console.log(`      Price: $${child.price}`);

          if (child.status === 'PENDING' && child.price === 0) {
            // Delete unconfirmed package children
            await prisma.booking.delete({
              where: { id: child.id }
            });
            console.log(`      ❌ Deleted (unconfirmed)`);
          } else {
            // Keep confirmed bookings, just remove parent link
            await prisma.booking.update({
              where: { id: child.id },
              data: {
                parentBookingId: null,
                userId: userId
              }
            });
            console.log(`      ✅ Kept and linked to user`);
          }
        }

        // Delete the package booking record
        await prisma.booking.delete({
          where: { id: pkg.id }
        });

        console.log(`   ❌ Deleted package booking record`);
        console.log(`   ✅ Migration complete for this package`);

        migratedCount++;

      } catch (error) {
        console.error(`   ❌ Error migrating package:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total packages found: ${packagePurchases.length}`);
    console.log(`   Successfully migrated: ${migratedCount}`);
    console.log(`   Errors: ${errorCount}\n`);

    // Now link all orphaned bookings to user accounts
    console.log(`\n🔗 Linking orphaned bookings to user accounts...\n`);

    const orphanedBookings = await prisma.booking.findMany({
      where: {
        userId: null,
        client: {
          userId: { not: null }
        }
      },
      include: {
        client: true
      }
    });

    console.log(`Found ${orphanedBookings.length} orphaned bookings\n`);

    let linkedCount = 0;
    for (const booking of orphanedBookings) {
      if (booking.client?.userId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { userId: booking.client.userId }
        });
        linkedCount++;
      }
    }

    console.log(`✅ Linked ${linkedCount} bookings to user accounts\n`);

    // Final verification
    console.log(`\n🔍 Final Verification:\n`);

    const remainingPackages = await prisma.booking.count({
      where: { isPackageBooking: true }
    });

    const orphanedCount = await prisma.booking.count({
      where: {
        userId: null,
        client: {
          userId: { not: null }
        }
      }
    });

    console.log(`   Remaining package bookings: ${remainingPackages}`);
    console.log(`   Remaining orphaned bookings: ${orphanedCount}\n`);

    if (remainingPackages === 0 && orphanedCount === 0) {
      console.log(`✅ Migration completed successfully!\n`);
    } else {
      console.log(`⚠️  Some issues remain - review above logs\n`);
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePackagesToWallet();
