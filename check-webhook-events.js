// Load env manually
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 Checking webhook events for succeeded payment intents...\n');

  const piIds = [
    'pi_3TCcpSPFqwsHwRMq1WYs4r4l', // succeeded $652.68
    'pi_3TCu9WPFqwsHwRMq0UFPeyNL', // succeeded $725.20
  ];

  for (const piId of piIds) {
    const events = await prisma.webhookEvent.findMany({
      where: { idempotencyKey: { contains: piId } }
    });
    console.log(`PaymentIntent: ${piId}`);
    if (events.length === 0) {
      console.log('  ❌ NO webhook events recorded — webhook never fired or failed before recording');
    } else {
      events.forEach(e => {
        console.log(`  ✅ Event: ${e.eventType}  key=${e.idempotencyKey}`);
        console.log(`     metadata=${JSON.stringify(e.metadata)}`);
        console.log(`     processedAt=${e.processedAt}`);
      });
    }
    console.log();
  }

  // Also check the two bookings directly
  const bookingIds = [
    '69bbc0feabfa1df274bb8f46',
    '69bcc52089752638a6065173',
  ];

  console.log('📋 Booking details for succeeded payments:');
  for (const id of bookingIds) {
    const b = await prisma.booking.findUnique({ where: { id } });
    if (b) {
      console.log(`\n  Booking ${id}:`);
      console.log(`    status=${b.status}  isPaid=${b.isPaid}  isPackageBooking=${b.isPackageBooking}`);
      console.log(`    price=$${b.price}  packageTotalPaid=$${b.packageTotalPaid ?? 'null'}  packageHours=${b.packageHours}`);
      console.log(`    clientId=${b.clientId}  clientPhone=${b.clientPhone}`);
    }
  }

  console.log('\n✅ Done\n');
}

check().catch(console.error).finally(() => prisma.$disconnect());
