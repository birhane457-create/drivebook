/**
 * MM-12 Production Preflight
 * Checks DB state before running the full MM-12 production verification.
 * READ-ONLY.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('MM-12 Production Preflight');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('');

// Check AdminWalletIdempotencyKey table exists
const tableCheck = await prisma.$queryRaw`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'AdminWalletIdempotencyKey'
`;
console.log('AdminWalletIdempotencyKey table:', tableCheck.length > 0 ? 'PRESENT' : 'MISSING — MM-12-D migration not applied');

// Check constraint on the table
if (tableCheck.length > 0) {
  const pkCheck = await prisma.$queryRaw`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'AdminWalletIdempotencyKey'
  `;
  console.log('Constraints:', JSON.stringify(pkCheck));
}

// Find a test customer (not real customer) to use for verification
const testCustomers = await prisma.customer.findMany({
  where: { email: { contains: 'mm12-prod-verify' } },
  select: { id: true, email: true },
  take: 1,
});
console.log('Existing MM-12 test customer:', testCustomers.length > 0 ? JSON.stringify(testCustomers[0]) : 'none — will need to create one');

// Check count of existing AdminWalletIdempotencyKey rows
const keyCount = await prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "AdminWalletIdempotencyKey"`;
console.log('Existing idempotency key rows:', keyCount[0].cnt);

await prisma.$disconnect();
