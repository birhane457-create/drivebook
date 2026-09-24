/**
 * Creates dedicated MM-12 production verification fixtures.
 * Outputs the IDs and credentials needed by the verification script.
 * Safe to re-run — skips creation if fixtures already exist.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL    = 'mm12-prod-verify-admin@test.internal';
const CUSTOMER_EMAIL = 'mm12-prod-verify-customer@test.internal';
const ADMIN_PASS     = 'mm12-prod-verify-pass-2026';

// Admin user
let adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
if (!adminUser) {
  const hashed = await bcrypt.hash(ADMIN_PASS, 10);
  adminUser = await prisma.user.create({
    data: { email: ADMIN_EMAIL, name: 'MM-12 Prod Verify Admin', role: 'ADMIN', password: hashed, emailVerified: true },
  });
  await prisma.staffMember.create({
    data: {
      userId: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      department: 'ADMIN',
      permissions: ['finance.credits.manage', 'users.customers.wallet_deduct'],
      maxRefundAmount: 10000,
    },
  });
  console.log('Created admin:', adminUser.id);
} else {
  console.log('Admin exists:', adminUser.id);
}

// Customer user + wallet
let customerUser = await prisma.user.findUnique({ where: { email: CUSTOMER_EMAIL } });
if (!customerUser) {
  customerUser = await prisma.user.create({
    data: { email: CUSTOMER_EMAIL, name: 'MM-12 Prod Verify Customer', role: 'CLIENT', emailVerified: true },
  });
  console.log('Created customer:', customerUser.id);
} else {
  console.log('Customer exists:', customerUser.id);
}

let customer = await prisma.customer.findFirst({ where: { userId: customerUser.id } });
if (!customer) {
  customer = await prisma.customer.create({
    data: { userId: customerUser.id, name: customerUser.name, email: customerUser.email, phone: '000-0000' },
  });
  console.log('Created customer record:', customer.id);
} else {
  console.log('Customer record exists:', customer.id);
}

let wallet = await prisma.clientWallet.findUnique({ where: { userId: customerUser.id } });
if (!wallet) {
  wallet = await prisma.clientWallet.create({ data: { userId: customerUser.id, balance: 0 } });
  console.log('Created wallet:', wallet.id);
} else {
  console.log('Wallet exists:', wallet.id);
}

console.log('');
console.log('=== Use these values for verification script ===');
console.log(`ADMIN_EMAIL:     ${ADMIN_EMAIL}`);
console.log(`ADMIN_PASS:      ${ADMIN_PASS}`);
console.log(`CUSTOMER_ID:     ${customer.id}`);
console.log(`WALLET_ID:       ${wallet.id}`);

await prisma.$disconnect();
