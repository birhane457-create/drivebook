import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const rows = await p.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'Subscription'
       AND column_name IN ('lastWebhookEventId','lastWebhookEventTimestamp','metadata')
     ORDER BY column_name`
  );
  console.log('Columns found in test DB:', JSON.stringify(rows, null, 2));
  if (rows.length === 0) {
    console.log('RESULT: MISSING — columns not present in database');
  } else {
    console.log(`RESULT: PRESENT — ${rows.length}/3 column(s) found`);
  }
} catch (e) {
  console.error('Query failed:', e.message);
} finally {
  await p.$disconnect();
}
