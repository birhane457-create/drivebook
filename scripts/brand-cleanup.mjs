import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env' });
const prisma = new PrismaClient();

// Clean up any v01test / v15test orphan rows and restore real provider
const orphanProviders = await prisma.provider.findMany({
  where: { id: { startsWith: 'v0' } },
  select: { id: true, customDomain: true },
});
console.log('Orphan providers:', orphanProviders);

for (const p of orphanProviders) {
  await prisma.provider.delete({ where: { id: p.id } }).catch(e => console.log('delete provider:', e.message));
}

const orphanUsers = await prisma.user.findMany({
  where: { id: { startsWith: 'v0' } },
  select: { id: true, email: true },
});
console.log('Orphan users:', orphanUsers);

for (const u of orphanUsers) {
  await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('delete user:', e.message));
}

// Restore real provider
const realProvider = await prisma.provider.findFirst({
  where: { user: { email: 'birhane157@gmail.com' } },
  select: { id: true, customDomain: true, domainVerified: true, subscriptionTier: true },
});
console.log('Real provider state:', realProvider);

if (realProvider && (realProvider.customDomain?.startsWith('v01-') || realProvider.customDomain?.startsWith('v15-'))) {
  await prisma.provider.update({
    where: { id: realProvider.id },
    data: { customDomain: null, domainVerified: false, subscriptionTier: 'PRO' },
  });
  console.log('Restored real provider: customDomain=null domainVerified=false tier=PRO');
}

await prisma.$disconnect();
console.log('Done.');
