const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const email = 'birhane1457@gmail.com';
  console.log(`\n🔍 Checking: ${email}\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      wallet: {
        include: {
          transactions: { orderBy: { createdAt: 'desc' } }
        }
      },
      clients: {
        include: {
          bookings: {
            orderBy: { createdAt: 'desc' },
            include: { instructor: { select: { name: true } } }
          }
        }
      }
    }
  });

  if (!user) { console.log('❌ User not found'); return; }

  console.log(`✅ User: ${user.name} (id=${user.id})`);

  // Bookings
  const bookings = user.clients.flatMap(c => c.bookings);
  console.log(`\n📅 BOOKINGS (${bookings.length}):`);
  bookings.forEach((b, i) => {
    console.log(`\n  [${i+1}] id=${b.id}`);
    console.log(`       status=${b.status}  isPaid=${b.isPaid}  isPackage=${b.isPackageBooking}`);
    console.log(`       price=$${b.price}  packageTotalPaid=$${(b).packageTotalPaid ?? 'null'}  packageHours=${b.packageHours ?? 'null'}`);
    console.log(`       startTime=${b.startTime}  endTime=${b.endTime}`);
    console.log(`       paymentIntentId=${b.paymentIntentId ?? 'null'}`);
    console.log(`       instructor=${b.instructor?.name}`);
  });

  // Wallet
  console.log(`\n💰 WALLET:`);
  if (!user.wallet) {
    console.log('  ❌ No wallet exists');
  } else {
    const txs = user.wallet.transactions;
    console.log(`  walletId=${user.wallet.id}  transactions=${txs.length}`);
    let credits = 0, debits = 0;
    txs.forEach((t, i) => {
      const sign = t.type === 'CREDIT' ? '+' : '-';
      console.log(`  [${i+1}] ${t.type} ${sign}$${t.amount}  status=${t.status}  desc="${t.description}"  created=${t.createdAt}`);
      if (t.status === 'CONFIRMED') {
        if (t.type === 'CREDIT') credits += t.amount;
        else debits += t.amount;
      }
    });
    console.log(`\n  CONFIRMED balance: +$${credits.toFixed(2)} credits - $${debits.toFixed(2)} debits = $${(credits - debits).toFixed(2)}`);
  }

  console.log('\n✅ Done\n');
}

check().catch(console.error).finally(() => prisma.$disconnect());
