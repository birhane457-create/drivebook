/**
 * Backfill script for payments that succeeded in Stripe but webhook failed
 * (because WebhookEvent model was missing from schema)
 * 
 * Succeeded payments:
 *   pi_3TCcpSPFqwsHwRMq1WYs4r4l → booking 69bbc0feabfa1df274bb8f46 ($652.68)
 *   pi_3TCu9WPFqwsHwRMq0UFPeyNL → booking 69bcc52089752638a6065173 ($725.20)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PAYMENTS = [
  {
    paymentIntentId: 'pi_3TCcpSPFqwsHwRMq1WYs4r4l',
    bookingId: '69bbc0feabfa1df274bb8f46',
    amountCharged: 652.68,
    // This booking has price=$652.68 (old bug: price was set to package total)
    // packageTotalPaid=null — treat the charged amount as the package total
    isOldBugBooking: true,
  },
  {
    paymentIntentId: 'pi_3TCu9WPFqwsHwRMq0UFPeyNL',
    bookingId: '69bcc52089752638a6065173',
    amountCharged: 725.20,
    // This booking has price=$70 (correct), packageTotalPaid=$725.20 (correct)
    isOldBugBooking: false,
  },
];

async function backfill() {
  console.log('\n🔧 Backfilling succeeded payments...\n');

  for (const payment of PAYMENTS) {
    console.log(`\n--- Processing ${payment.paymentIntentId} ---`);

    const booking = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: { client: true }
    });

    if (!booking) {
      console.log(`❌ Booking ${payment.bookingId} not found`);
      continue;
    }

    console.log(`  Booking: status=${booking.status}  isPaid=${booking.isPaid}`);
    console.log(`  price=$${booking.price}  packageTotalPaid=$${booking.packageTotalPaid ?? 'null'}`);
    console.log(`  isPackageBooking=${booking.isPackageBooking}  packageHours=${booking.packageHours}`);

    if (booking.isPaid && booking.status === 'CONFIRMED') {
      console.log(`  ✅ Already confirmed — skipping`);
      continue;
    }

    // Resolve userId
    let userId = booking.client?.userId;
    if (!userId && booking.clientId) {
      const client = await prisma.client.findUnique({ where: { id: booking.clientId } });
      userId = client?.userId ?? undefined;
    }
    console.log(`  userId=${userId ?? '❌ NOT FOUND'}`);

    // Determine wallet amounts
    // For old-bug bookings: price was set to package total, so use amountCharged as packageTotal
    // and derive lesson price from hourlyRate (we'll use $70 as the standard 1hr rate)
    const packageTotalPaid = booking.packageTotalPaid ?? payment.amountCharged;
    const lessonPrice = payment.isOldBugBooking ? 70 : booking.price; // $70 = 1hr lesson

    await prisma.$transaction(async (tx) => {
      // 1. Mark booking as paid + confirmed
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          isPaid: true,
          paidAt: new Date(),
          status: 'CONFIRMED',
          paymentCaptured: true,
          paymentCapturedAt: new Date(),
          // Fix packageTotalPaid if it was null
          ...(booking.packageTotalPaid === null ? { packageTotalPaid: payment.amountCharged } : {}),
          // Fix price if it was set to package total (old bug)
          ...(payment.isOldBugBooking ? { price: lessonPrice } : {}),
        }
      });
      console.log(`  ✅ Booking marked CONFIRMED + isPaid=true`);

      // 2. Wallet operations
      if (userId) {
        let wallet = await tx.clientWallet.findUnique({ where: { userId } });
        if (!wallet) {
          wallet = await tx.clientWallet.create({ data: { userId } });
          console.log(`  ✅ Wallet created`);
        }

        // CREDIT: full package amount
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: packageTotalPaid,
            description: `Package purchase — ${booking.packageHours} hours (Stripe backfill)`,
            status: 'CONFIRMED',
          }
        });
        console.log(`  ✅ CREDIT +$${packageTotalPaid}`);

        // DEBIT: first lesson
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: lessonPrice,
            description: `First lesson — ${new Date(booking.startTime).toLocaleDateString('en-AU')} (booking #${payment.bookingId})`,
            status: 'CONFIRMED',
          }
        });
        console.log(`  ✅ DEBIT -$${lessonPrice}`);
        console.log(`  💰 Remaining balance: $${(packageTotalPaid - lessonPrice).toFixed(2)}`);
      } else {
        console.log(`  ⚠️ No userId — wallet ops skipped`);
      }
    });

    console.log(`  ✅ Done for ${payment.paymentIntentId}`);
  }

  // Final check
  console.log('\n\n📊 Final state:\n');
  const user = await prisma.user.findUnique({
    where: { email: 'birhane1457@gmail.com' },
    include: {
      wallet: { include: { transactions: { orderBy: { createdAt: 'desc' } } } }
    }
  });

  if (user?.wallet) {
    const txs = user.wallet.transactions;
    let credits = 0, debits = 0;
    txs.forEach(t => {
      if (t.status === 'CONFIRMED') {
        if (t.type === 'CREDIT') credits += t.amount;
        else debits += t.amount;
      }
      console.log(`  ${t.type} $${t.amount}  status=${t.status}  "${t.description}"`);
    });
    console.log(`\n  Balance: +$${credits.toFixed(2)} - $${debits.toFixed(2)} = $${(credits - debits).toFixed(2)}`);
  }

  console.log('\n✅ Backfill complete\n');
}

backfill().catch(console.error).finally(() => prisma.$disconnect());
