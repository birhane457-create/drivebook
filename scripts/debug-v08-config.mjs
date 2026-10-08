import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env' });
const prisma = new PrismaClient();

const TS     = Date.now();
const userId = `dbg08-u-${TS}`;
const provId = `dbg08-p-${TS}`;
const bizId  = `biz_${provId}`;

// Create minimal fixtures
await prisma.user.create({ data: { id: userId, email: `dbg08-${TS}@audit.test`, name: 'Debug', role: 'provider', emailVerified: true } });
await prisma.provider.create({ data: { id: provId, userId, name: 'Debug Plumber', phone: '+61400000022', hourlyRate: 100, subscriptionTier: 'PRO', subscriptionStatus: 'ACTIVE' } });
await prisma.business.create({ data: { id: bizId, name: 'Debug Plumbing', supportEmail: `dbg-${TS}@audit.test`, templateSlug: 'plumber', paymentModel: 'saas' } });
await prisma.businessTerminology.create({ data: { businessId: bizId, booking: 'Appointment', bookings: 'Appointments', provider: 'Plumber', providers: 'Plumbers', customer: 'Client', customers: 'Clients', service: 'Service', services: 'Services', providerGroup: 'Business' } });
await prisma.businessBranding.create({ data: { businessId: bizId, primaryColour: '#22C55E' } });

console.log('Fixtures created. bizId:', bizId);

// Now try to load config as getBusinessConfig would
const business = await prisma.business.findUnique({ where: { id: bizId } });
const terminology = await prisma.businessTerminology.findUnique({ where: { businessId: bizId } });
console.log('Business found:', business?.id ?? 'NULL');
console.log('Terminology found:', terminology?.booking ?? 'NULL');

// Check if the terminology table query has a provider field issue
try {
  const all = await prisma.businessTerminology.findMany({ where: { businessId: bizId } });
  console.log('All terminology rows:', JSON.stringify(all));
} catch (e) {
  console.log('Error querying terminology:', e.message);
}

// Cleanup
await prisma.businessBranding.deleteMany({ where: { businessId: bizId } }).catch(() => {});
await prisma.businessTerminology.deleteMany({ where: { businessId: bizId } }).catch(() => {});
await prisma.business.deleteMany({ where: { id: bizId } }).catch(() => {});
await prisma.provider.deleteMany({ where: { id: provId } }).catch(() => {});
await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
console.log('Cleanup done.');

await prisma.$disconnect();
